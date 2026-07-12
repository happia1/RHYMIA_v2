# -*- coding: utf-8 -*-
"""
Fridge 일정/루틴 파싱 에이전트 (LangGraph 기반)
Plan -> ClassifyIntent -> Execute -> (여러 일정: RefineRoutine | 단일: RefineSchedule -> RefineRoutine) -> Finalize 구조.
날짜(일정)/시간(루틴 블록)이 없으면 각 Refine 노드에서 interrupt로 멈추고, 사용자 답변으로 재개(resume)한다.
DB 저장은 하지 않는다 — 파싱 결과만 반환하고, 실제 저장은 Next.js의 createSchedule/upsertRoutine
서버 액션이 사용자 확인(등록 버튼) 후에 수행한다.
"""

from __future__ import annotations

import base64
import json
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal, Optional, TypedDict

from dotenv import load_dotenv
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt, Command
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

load_dotenv()

if not os.getenv("GEMINI_API_KEY"):
    print("경고: GEMINI_API_KEY를 찾을 수 없습니다. .env 파일을 확인하세요.")

MODEL_NAME = "gemini-2.5-flash"


# ---------- 상태 정의 ----------
class AgentState(TypedDict, total=False):
    user_text: Optional[str]
    image_path: Optional[str]  # 로컬 파일 경로 또는 data:image/...;base64,... URL
    input_type: Optional[Literal["image", "text"]]

    intent: Optional[Literal["schedule", "routine", "mixed"]]

    extracted: Optional[dict]        # 단일 일정 (Fridge schedule 스키마)
    extracted_list: Optional[list]   # 여러 일정 (이미지 표/목록 등)

    extracted_routines: Optional[list]     # 추출된 루틴 그룹들 (정규화됨)
    routine_target_hint: Optional[str]

    refinement_question: Optional[str]
    user_reply: Optional[str]

    schedules: Optional[list]        # 최종 반환값 (항상 배열)
    routines: Optional[list]         # 최종 반환값 (항상 배열)


# ---------- Fridge schedule 키워드 그룹 (src/lib/scheduleKeywords.ts와 동일하게 유지) ----------
KEYWORD_GROUPS: dict[str, list[str]] = {
    "공휴일": ["법정공휴일", "대체공휴일"],
    "여행": ["국내여행", "해외여행", "당일치기"],
    "행사": ["생일", "기념일", "기일", "결혼식", "장례식"],
    "교육": ["방학", "모의고사", "중간고사", "기말고사", "현장학습", "입학", "졸업"],
    "건강": ["병원", "검진", "예방접종"],
    "기타": [],
}

# 루틴 상태 어휘 (src/lib/routineUtils.ts의 STATUS_OPTIONS와 동일하게 유지 — --routine-* 색상 변수와 매핑됨)
ROUTINE_STATUS_OPTIONS: list[str] = ["업무", "수업", "운동", "공부", "휴식", "취침", "이동", "커스텀"]
DEFAULT_ROUTINE_STATUS = "커스텀"

# 의도 분류 신호 — 루틴 신호가 하나라도 있으면 "routine"(또는 일정 신호와 겹치면 "mixed"),
# 없으면 항상 "schedule"로 판단해 기존 일정 파이프라인의 동작을 그대로 보존한다.
ROUTINE_SIGNALS = [
    "매주", "평일", "매일", "하루 일과", "하루일과", "루틴", "일과표",
    "기상", "등원", "하원", "등교", "하교", "출근", "퇴근", "취침",
]
SCHEDULE_DATE_PATTERNS = [
    r"내일", r"모레", r"글피", r"다음\s*주", r"다음\s*달",
    r"\d{1,2}\s*월\s*\d{1,2}\s*일", r"\d{1,2}[/.\-]\d{1,2}",
]


def _default_schedule() -> dict:
    """추출 실패 또는 빈 입력 시 반환하는 기본 구조 (Fridge schedule 스키마)."""
    return {
        "title": "새 일정",
        "date_start": None,
        "date_end": None,
        "time_start": None,
        "time_end": None,
        "supplies": None,
        "memo": None,
        "keyword_main": None,
        "keyword_sub": None,
        "is_important": False,
        "target_hint": None,
    }


def _log_node(name: str, payload: object = None) -> None:
    print(f"\n── [{name}] " + "─" * 40)
    if payload is not None:
        print(json.dumps(payload, ensure_ascii=False, indent=2))


# ---------- 상대 날짜 해석 (내일/모레/N일 뒤 등) ----------
def _resolve_relative_date(text: str, base: datetime) -> Optional[tuple[int, int, int]]:
    s = (text or "").strip()
    if not s:
        return None
    days_match = re.search(r"(\d+)\s*일\s*(뒤|후)", s)
    if days_match:
        target = base.date() + timedelta(days=int(days_match.group(1)))
        return (target.year, target.month, target.day)
    if re.search(r"내일", s):
        target = base.date() + timedelta(days=1)
        return (target.year, target.month, target.day)
    if re.search(r"모레", s):
        target = base.date() + timedelta(days=2)
        return (target.year, target.month, target.day)
    if re.search(r"글피", s):
        target = base.date() + timedelta(days=3)
        return (target.year, target.month, target.day)
    if re.search(r"다음\s*주", s):
        target = base.date() + timedelta(days=7)
        return (target.year, target.month, target.day)
    if re.search(r"오늘|이번\s*주", s):
        return (base.year, base.month, base.day)
    return None


def _normalize_date_str(raw: str, now: datetime) -> Optional[str]:
    """다양한 표현의 날짜 문자열을 YYYY-MM-DD로 정규화. 실패하면 None."""
    s = (raw or "").strip()
    if not s:
        return None

    iso = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if iso:
        year, month, day = int(iso.group(1)), int(iso.group(2)), int(iso.group(3))
    else:
        resolved = _resolve_relative_date(s, now)
        if resolved:
            year, month, day = resolved
        else:
            m = re.search(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일", s)
            if not m:
                m = re.search(r"(\d{1,2})[/.\-](\d{1,2})", s)
            if not m:
                return None
            month, day = int(m.group(1)), int(m.group(2))
            year_match = re.search(r"(20\d{2})", s)
            year = int(year_match.group(1)) if year_match else now.year

    try:
        date_val = datetime(year, month, day).date()
    except ValueError:
        return None

    # LLM이 실수로 과거 연도를 썼을 가능성 보정 (상대 표현이 아닌 명시적 월/일 표기에 한함)
    if date_val < now.date() and not iso:
        try:
            date_val = datetime(now.year, month, day).date()
        except ValueError:
            pass

    return date_val.strftime("%Y-%m-%d")


def _normalize_time_str(raw: str) -> Optional[str]:
    """다양한 표현의 시간 문자열을 HH:MM(24시간제)로 정규화. 실패하면 None."""
    s = (raw or "").strip()
    if not s:
        return None

    colon = re.match(r"^(\d{1,2}):(\d{2})", s)
    if colon:
        hour, minute = int(colon.group(1)), int(colon.group(2))
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return f"{hour:02d}:{minute:02d}"

    pm = re.search(r"오후\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?", s)
    if pm:
        hour = int(pm.group(1))
        minute = int(pm.group(2)) if pm.group(2) else 0
        if hour < 12:
            hour += 12
        return f"{hour:02d}:{minute:02d}"

    am = re.search(r"오전\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?", s)
    if am:
        hour = int(am.group(1))
        minute = int(am.group(2)) if am.group(2) else 0
        if hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"

    return None


def _normalize_schedule(data: dict, now: datetime) -> dict:
    """LLM이 반환한 raw dict를 Fridge schedule 스키마로 정규화."""

    def opt_str(key: str) -> Optional[str]:
        val = data.get(key)
        text = str(val).strip() if val is not None else ""
        return text or None

    title = str(data.get("title") or "").strip() or "새 일정"

    date_start = _normalize_date_str(str(data.get("date_start") or ""), now)
    date_end = _normalize_date_str(str(data.get("date_end") or ""), now)
    time_start = _normalize_time_str(str(data.get("time_start") or ""))
    time_end = _normalize_time_str(str(data.get("time_end") or ""))

    keyword_main = opt_str("keyword_main")
    if keyword_main not in KEYWORD_GROUPS:
        keyword_main = None
    keyword_sub = opt_str("keyword_sub")
    if keyword_main is None or keyword_sub not in KEYWORD_GROUPS.get(keyword_main, []):
        keyword_sub = None

    is_important_raw = data.get("is_important")
    is_important = is_important_raw is True or str(is_important_raw).strip().lower() == "true"

    return {
        "title": title,
        "date_start": date_start,
        "date_end": date_end,
        "time_start": time_start,
        "time_end": time_end,
        "supplies": opt_str("supplies"),
        "memo": opt_str("memo"),
        "keyword_main": keyword_main,
        "keyword_sub": keyword_sub,
        "is_important": is_important,
        "target_hint": opt_str("target_hint"),
    }


def _response_text(response) -> str:
    """LLM 응답에서 텍스트만 추출 (일부 버전은 content가 리스트로 올 수 있어 방어적으로 처리)."""
    content = response.content
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and "text" in item:
                parts.append(str(item["text"]))
        return "".join(parts).strip()
    return str(content or "").strip()


def _strip_json_fence(text: str) -> str:
    stripped = text
    if "```" in stripped:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", stripped)
        if match:
            stripped = match.group(1).strip()
    return stripped


def _parse_schedule_json(text: str, now: datetime) -> dict | list:
    """LLM 출력에서 JSON(단일 객체 또는 배열)만 골라 파싱 후 정규화. 실패하면 기본값."""
    try:
        data = json.loads(_strip_json_fence(text))
        if isinstance(data, list):
            return [_normalize_schedule(item, now) for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            return _normalize_schedule(data, now)
    except (json.JSONDecodeError, TypeError):
        pass
    return _default_schedule()


def _apply_user_reply_to_extracted(extracted: dict, user_reply: str, now: datetime) -> dict:
    """Refine에서 '날짜를 알려주세요'라고 물은 뒤 받은 답변을 반영."""
    updated = dict(extracted)
    reply = (user_reply or "").strip()
    if not reply:
        return updated
    if not updated.get("date_start"):
        resolved_date = _normalize_date_str(reply, now)
        if resolved_date:
            updated["date_start"] = resolved_date
    if not updated.get("time_start"):
        resolved_time = _normalize_time_str(reply)
        if resolved_time:
            updated["time_start"] = resolved_time
    return updated


def _keyword_guide() -> str:
    lines = []
    for main, subs in KEYWORD_GROUPS.items():
        subs_str = ", ".join(subs) if subs else "(세부 항목 없음)"
        lines.append(f'- "{main}": {subs_str}')
    return "\n".join(lines)


def _build_instruction(now: datetime, has_image: bool) -> str:
    weekdays = "월화수목금토일"
    today_label = f"{now.year}년 {now.month}월 {now.day}일 ({weekdays[now.weekday()]}요일)"
    source = "이미지(가정통신문·학사일정표·초대장 등)" if has_image else "텍스트"
    return f"""오늘은 {today_label}입니다. 아래 {source}에서 아이 가정의 일정 정보를 추출해 JSON으로만 답하세요.

이미지 안에 여러 일정(표·목록 등)이 있으면 JSON **배열**로, 각 항목마다 아래 키를 사용하세요.
일정이 하나뿐이면 아래 키를 가진 **단일 JSON 객체** 하나만 출력하세요.

- "title": 일정 제목
- "date_start": 시작 날짜, 반드시 "YYYY-MM-DD" 형식. "내일"/"모레"/"다음 주" 등 상대 표현은 오늘 기준으로 계산한 구체적 날짜로 변환하고, 반드시 {now.year}년 기준으로 넣으세요(과거 연도로 쓰지 마세요). 알 수 없으면 null.
- "date_end": 기간이 있는 일정이면 종료 날짜("YYYY-MM-DD"), 없으면 null
- "time_start": 시작 시각 "HH:MM"(24시간제). 종일이거나 알 수 없으면 null
- "time_end": 종료 시각 "HH:MM", 없으면 null
- "supplies": 준비물을 쉼표로 나열한 문자열, 없으면 null
- "memo": 주의사항·비고를 한두 줄로, 없으면 null
- "keyword_main": 아래 카테고리 중 하나만 선택 (애매하면 "기타")
{_keyword_guide()}
- "keyword_sub": keyword_main에 속한 세부 항목 중 하나(위 목록 참고). 해당하는 세부 항목이 없으면 null
- "is_important": 공지·마감처럼 중요하게 챙겨야 하는 일정이면 true, 아니면 false
- "target_hint": "첫째", "둘째", "가족" 처럼 이 일정이 누구를 위한 것인지 짐작되는 짧은 표현. 알 수 없으면 null

문자열 필드 값을 알 수 없으면 null로, is_important를 모르면 false로 두세요. JSON 외의 설명은 절대 출력하지 마세요."""


def _extract_from_text(user_text: str, now: datetime) -> dict | list:
    if not (user_text or "").strip():
        return _default_schedule()

    llm = ChatGoogleGenerativeAI(
        model=MODEL_NAME,
        temperature=0,
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )
    instruction = _build_instruction(now, has_image=False)
    prompt = f"{instruction}\n\n텍스트:\n{user_text}"
    response = llm.invoke(prompt)
    return _parse_schedule_json(_response_text(response), now)


def _image_path_to_data_url(image_path: str) -> Optional[str]:
    if image_path.startswith("data:"):
        return image_path
    path = Path(image_path)
    if not path.exists():
        return None
    with open(path, "rb") as f:
        b64 = base64.standard_b64encode(f.read()).decode("utf-8")
    ext = path.suffix.lower()
    mime = "image/png" if ext == ".png" else "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
    return f"data:{mime};base64,{b64}"


def extract_text_from_image(image_path: str) -> str:
    """이미지에서 읽을 수 있는 텍스트만 그대로 추출 (메모/공지 내용란 자동 채우기용, DB 저장 없음)."""
    image_url = _image_path_to_data_url(image_path)
    if not image_url:
        return ""

    llm = ChatGoogleGenerativeAI(
        model=MODEL_NAME,
        temperature=0,
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )
    instruction = (
        "아래 이미지에서 읽을 수 있는 텍스트를 최대한 원문 그대로 추출하세요. "
        "설명, 마크다운, 따옴표 없이 추출된 텍스트만 출력하세요. "
        "읽을 수 있는 텍스트가 없으면 빈 문자열만 출력하세요."
    )
    message = HumanMessage(
        content=[
            {"type": "text", "text": instruction},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]
    )
    response = llm.invoke([message])
    return _response_text(response)


# ---------- 끼니 영양 정보(추정) ----------
def _default_nutrition() -> dict:
    return {
        "kcal_min": None,
        "kcal_max": None,
        "macro_carb": None,
        "macro_protein": None,
        "macro_fat": None,
    }


def _clamp_int(val: object, lo: int, hi: int) -> Optional[int]:
    try:
        n = int(round(float(val)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return max(lo, min(hi, n))


def _normalize_macros(carb: int, protein: int, fat: int) -> tuple[int, int, int]:
    """세 비율의 합이 정확히 100이 되도록 스케일링하고, 반올림 오차는 가장 큰 값에 몰아준다."""
    values = [max(0, carb), max(0, protein), max(0, fat)]
    total = sum(values)
    if total <= 0:
        return (50, 25, 25)  # 정보가 전혀 없을 때의 중립 기본값(탄수화물 위주 식사 가정)
    scaled = [round(v * 100 / total) for v in values]
    diff = 100 - sum(scaled)
    scaled[scaled.index(max(scaled))] += diff
    return (scaled[0], scaled[1], scaled[2])


def _build_nutrition_instruction(menu_name: str) -> str:
    return f"""아래는 가정에서 먹은 끼니의 메뉴입니다: "{menu_name}"

일반적인 성인 1인분 기준으로 예상 칼로리와 탄수화물/단백질/지방 비율을 추정하세요.
이것은 정밀한 영양 계산이 아니라 대략적인 참고용 추정치입니다 — 메뉴 정보만으로는 확신하기
어려우니, 확신이 없을수록 칼로리 범위(kcal_min~kcal_max)를 더 넓게 잡으세요. 좁은 범위는
꽤 확신이 있을 때만 쓰세요.

아래 JSON 객체 하나로만 답하세요. 설명이나 마크다운 없이 JSON만 출력하세요.
{{
  "kcal_min": 정수(kcal, 하한),
  "kcal_max": 정수(kcal, 상한, kcal_min 이상),
  "macro_carb": 정수(탄수화물 비율 %),
  "macro_protein": 정수(단백질 비율 %),
  "macro_fat": 정수(지방 비율 %)
}}
macro_carb + macro_protein + macro_fat의 합은 반드시 100이어야 합니다."""


def _parse_nutrition_json(text: str) -> dict:
    try:
        data = json.loads(_strip_json_fence(text))
    except (json.JSONDecodeError, TypeError):
        return _default_nutrition()
    if not isinstance(data, dict):
        return _default_nutrition()

    kcal_min = _clamp_int(data.get("kcal_min"), 0, 5000)
    kcal_max = _clamp_int(data.get("kcal_max"), 0, 5000)
    if kcal_min is None or kcal_max is None:
        return _default_nutrition()
    if kcal_max < kcal_min:
        kcal_min, kcal_max = kcal_max, kcal_min

    carb = _clamp_int(data.get("macro_carb"), 0, 100) or 0
    protein = _clamp_int(data.get("macro_protein"), 0, 100) or 0
    fat = _clamp_int(data.get("macro_fat"), 0, 100) or 0
    carb, protein, fat = _normalize_macros(carb, protein, fat)

    return {
        "kcal_min": kcal_min,
        "kcal_max": kcal_max,
        "macro_carb": carb,
        "macro_protein": protein,
        "macro_fat": fat,
    }


def estimate_nutrition(menu_name: str, image_path: Optional[str] = None) -> dict:
    """메뉴명(+선택적으로 사진)으로 일반적인 1인분 기준 칼로리 범위와 탄단지 비율을 추정한다.
    어디까지나 참고용 추정치라 프런트엔드에서도 항상 "추정" 딱지를 붙여 보여준다
    (Fridge meal.nutrition_source='estimate'). 실패하면 전부 None인 dict를 반환 —
    호출부(Next.js food/actions.ts)가 이 경우 meal에 아무것도 저장하지 않는다."""
    name = (menu_name or "").strip()
    if not name and not image_path:
        return _default_nutrition()

    llm = ChatGoogleGenerativeAI(
        model=MODEL_NAME,
        temperature=0,
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )
    instruction = _build_nutrition_instruction(name or "(메뉴명 없음, 사진 참고)")

    image_url = _image_path_to_data_url(image_path) if image_path else None
    if image_url:
        message = HumanMessage(
            content=[
                {"type": "text", "text": instruction},
                {"type": "image_url", "image_url": {"url": image_url}},
            ]
        )
        response = llm.invoke([message])
    else:
        response = llm.invoke(instruction)

    return _parse_nutrition_json(_response_text(response))


def _extract_from_image(image_path: str, user_text: str, now: datetime) -> dict | list:
    image_url = _image_path_to_data_url(image_path)
    if not image_url:
        return _default_schedule()

    llm = ChatGoogleGenerativeAI(
        model=MODEL_NAME,
        temperature=0,
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )
    instruction = _build_instruction(now, has_image=True)
    if (user_text or "").strip():
        instruction += f"\n\n사용자가 이미지와 함께 남긴 설명: {user_text.strip()}"

    message = HumanMessage(
        content=[
            {"type": "text", "text": instruction},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]
    )
    response = llm.invoke([message])
    return _parse_schedule_json(_response_text(response), now)


# ---------- 의도 분류 (일정 vs 루틴) ----------
def _classify_intent(text: str, has_image: bool) -> Literal["schedule", "routine", "mixed"]:
    """루틴 신호가 전혀 없으면 항상 'schedule' — 기존 일정 파이프라인의 동작을 100% 보존한다.
    이미지 입력은 루틴(반복 일과)을 아직 지원하지 않아 항상 'schedule'로 처리한다."""
    if has_image:
        return "schedule"
    s = text or ""
    has_routine = any(sig in s for sig in ROUTINE_SIGNALS)
    if not has_routine:
        return "schedule"
    has_schedule = any(re.search(p, s) for p in SCHEDULE_DATE_PATTERNS)
    return "mixed" if has_schedule else "routine"


# ---------- 루틴 추출/정규화 ----------
def _routine_status_guide() -> str:
    return ", ".join(ROUTINE_STATUS_OPTIONS)


def _build_routine_instruction(now: datetime) -> str:
    weekdays = "월화수목금토일"
    today_label = f"{now.year}년 {now.month}월 {now.day}일 ({weekdays[now.weekday()]}요일)"
    return f"""오늘은 {today_label}입니다. 아래 텍스트에서 반복되는 하루 일과(루틴)를 추출해 JSON **객체 하나**로만 답하세요.

출력 형식:
{{
  "routines": [
    {{
      "days": [0~6 정수 배열. 0=일요일, 1=월요일, ..., 6=토요일. "매일"→[0,1,2,3,4,5,6], "평일"→[1,2,3,4,5], "주말"→[0,6], 특정 요일만 언급되면 해당 요일만. 요일 언급이 전혀 없으면 빈 배열 []],
      "blocks": [
        {{
          "start": "HH:MM"(24시간제) 또는 알 수 없으면 null,
          "end": "HH:MM"(24시간제) 또는 알 수 없으면 null,
          "status": "다음 중 하나만: {_routine_status_guide()}. 등원/하원/통근처럼 이동이 핵심이면 '이동', 어디에도 맞지 않으면 '커스텀'",
          "label": "활동 이름 그대로 (예: 기상, 등원준비, 운동, 하원 픽업, 저녁, 취침 준비)",
          "memo": "추가로 언급된 세부사항, 없으면 null"
        }}
      ]
    }}
  ],
  "target_hint": "이 루틴이 누구의 것인지 짐작되는 짧은 표현 (예: 본인, 첫째, 둘째). 알 수 없으면 null"
}}

시간 처리 규칙 (중요):
- "7시부터 8시까지"처럼 범위가 있으면 그대로 start/end에 넣으세요.
- "7시 기상", "6시 저녁"처럼 **시점 하나만** 언급된 활동은 그 시각을 start로, start의 10분 뒤를 end로 설정하세요 (예: "7시 기상" → start "07:00", end "07:10"). 이런 경우는 시각이 명확하므로 null로 두면 안 됩니다.
- "오전에 운동"처럼 구체적 시각이 **전혀** 없는 경우에만 start와 end를 둘 다 null로 남기세요. 짐작해서 채우지 마세요.
- 텍스트에 명시적으로 언급된 활동만 블록으로 만드세요. "~하다가", "~까지 쉬고" 같은 언급되지 않은 빈 시간대는 절대 블록으로 만들지 마세요.

같은 텍스트 안에서 요일 그룹이 다르면(예: "평일은 이렇고 주말은 저렇고") routines 배열에 각각 별도 객체로 나누세요.
JSON 외의 설명은 절대 출력하지 마세요."""


def _normalize_days(raw: object) -> list[int]:
    if not isinstance(raw, list):
        return []
    days: set[int] = set()
    for item in raw:
        try:
            d = int(item)
        except (TypeError, ValueError):
            continue
        if 0 <= d <= 6:
            days.add(d)
    return sorted(days)


def _normalize_routine_block(raw: object) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    label = str(raw.get("label") or "").strip()
    if not label:
        return None

    start_raw = raw.get("start")
    end_raw = raw.get("end")
    start = _normalize_time_str(str(start_raw)) if start_raw else None
    end = _normalize_time_str(str(end_raw)) if end_raw else None

    status = str(raw.get("status") or "").strip()
    if status not in ROUTINE_STATUS_OPTIONS:
        status = DEFAULT_ROUTINE_STATUS

    memo_raw = raw.get("memo")
    memo = str(memo_raw).strip() if memo_raw else None

    return {"start": start, "end": end, "status": status, "label": label, "memo": memo}


def _normalize_routine_group(raw: object) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    blocks_raw = raw.get("blocks") or []
    blocks = [b for b in (_normalize_routine_block(x) for x in blocks_raw) if b]
    if not blocks:
        return None
    return {"days": _normalize_days(raw.get("days")), "blocks": blocks}


def _normalize_routines_payload(data: dict) -> dict:
    routines_raw = data.get("routines")
    routines: list[dict] = []
    if isinstance(routines_raw, list):
        for item in routines_raw:
            group = _normalize_routine_group(item)
            if group:
                routines.append(group)

    target_hint_raw = data.get("target_hint")
    target_hint = str(target_hint_raw).strip() if target_hint_raw else None
    return {"routines": routines, "target_hint": target_hint or None}


def _parse_routine_json(text: str) -> dict:
    try:
        data = json.loads(_strip_json_fence(text))
        if isinstance(data, dict):
            return _normalize_routines_payload(data)
    except (json.JSONDecodeError, TypeError):
        pass
    return {"routines": [], "target_hint": None}


def _extract_routines_from_text(user_text: str, now: datetime) -> dict:
    if not (user_text or "").strip():
        return {"routines": [], "target_hint": None}

    llm = ChatGoogleGenerativeAI(
        model=MODEL_NAME,
        temperature=0,
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )
    instruction = _build_routine_instruction(now)
    prompt = f"{instruction}\n\n텍스트:\n{user_text}"
    response = llm.invoke(prompt)
    return _parse_routine_json(_response_text(response))


# 루틴 refine에서 받은 답변("오전 10시부터 11시", "10:00~11:00" 등)에서 시각을 순서대로 추출
_TIME_TOKEN = re.compile(
    r"(오전|오후)?\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?|(\d{1,2}):(\d{2})"
)


def _extract_times_from_reply(text: str) -> list[str]:
    times: list[str] = []
    for m in _TIME_TOKEN.finditer(text or ""):
        meridiem, hour_kr, minute_kr, hour_colon, minute_colon = m.groups()
        if hour_colon is not None:
            hour, minute = int(hour_colon), int(minute_colon)
        else:
            hour, minute = int(hour_kr), int(minute_kr or 0)
            if meridiem == "오후" and hour < 12:
                hour += 12
            if meridiem == "오전" and hour == 12:
                hour = 0
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            times.append(f"{hour:02d}:{minute:02d}")
    return times


def _find_missing_time_block(routines: list[dict]) -> Optional[tuple[int, int]]:
    """start/end가 둘 다 없는(=완전히 애매한) 첫 블록의 (routine index, block index)를 찾는다."""
    for ri, group in enumerate(routines):
        for bi, block in enumerate(group.get("blocks") or []):
            if not block.get("start") and not block.get("end"):
                return ri, bi
    return None


# ---------- 1) Plan 노드 ----------
def plan_node(state: AgentState) -> AgentState:
    """입력이 이미지인지 텍스트인지 구분한다."""
    image_path = state.get("image_path")

    if image_path and (image_path.startswith("data:") or os.path.isfile(image_path)):
        input_type: Literal["image", "text"] = "image"
    else:
        input_type = "text"

    next_state = {**state, "input_type": input_type}
    _log_node("Plan", {"input_type": input_type})
    return next_state


# ---------- 2) ClassifyIntent 노드 ----------
def classify_intent_node(state: AgentState) -> AgentState:
    """일정인지 루틴인지(또는 둘 다인지) 판별한다. 재개(resume) 흐름에서는 재분류하지 않는다."""
    if state.get("intent"):
        return state

    has_image = state.get("input_type") == "image"
    intent = _classify_intent(state.get("user_text") or "", has_image)
    _log_node("ClassifyIntent", {"intent": intent})
    return {**state, "intent": intent}


# ---------- 3) Execute 노드 ----------
def execute_node(state: AgentState) -> AgentState:
    """Gemini 2.5 Flash로 이미지 또는 텍스트에서 일정/루틴 정보를 추출한다."""
    now = datetime.now()
    user_reply = state.get("user_reply")

    # RefineSchedule에서 질문한 뒤 받은 답변으로 기존 추출 결과 보완 (재추출하지 않음)
    if user_reply and state.get("extracted"):
        extracted = _apply_user_reply_to_extracted(state["extracted"], user_reply, now)
        next_state = {**state, "extracted": extracted, "extracted_list": None}
        _log_node("Execute (사용자 답변 반영)", extracted)
        return next_state

    intent = state.get("intent") or "schedule"
    image_path = state.get("image_path")
    user_text = state.get("user_text") or ""
    image_available = bool(image_path) and (
        image_path.startswith("data:") or os.path.isfile(image_path)
    )

    extracted: Optional[dict] = None
    extracted_list: Optional[list] = None
    extracted_routines: list = []
    routine_target_hint: Optional[str] = None

    if intent in ("schedule", "mixed"):
        raw = (
            _extract_from_image(image_path, user_text, now)
            if image_available
            else _extract_from_text(user_text, now)
        )
        if isinstance(raw, list) and len(raw) > 1:
            extracted_list = raw
        else:
            single = raw[0] if isinstance(raw, list) else raw
            extracted = single or _default_schedule()

    if intent in ("routine", "mixed") and not image_available:
        routine_payload = _extract_routines_from_text(user_text, now)
        extracted_routines = routine_payload.get("routines") or []
        routine_target_hint = routine_payload.get("target_hint")

    next_state = {
        **state,
        "extracted": extracted,
        "extracted_list": extracted_list,
        "extracted_routines": extracted_routines,
        "routine_target_hint": routine_target_hint,
    }
    _log_node(
        "Execute",
        {
            "intent": intent,
            "extracted": extracted,
            "extracted_list": extracted_list,
            "extracted_routines": extracted_routines,
            "routine_target_hint": routine_target_hint,
        },
    )
    return next_state


def _route_after_execute(state: AgentState) -> Literal["refine_schedule", "refine_routine"]:
    extracted_list = state.get("extracted_list") or []
    # 이미지에서 여러 일정이 나온 경우는 기존 동작과 동일하게 날짜 refine을 건너뛴다.
    return "refine_routine" if len(extracted_list) > 1 else "refine_schedule"


# ---------- 4) RefineSchedule 노드 (Cycle: 날짜 없으면 사용자에게 질문) ----------
def refine_schedule_node(state: AgentState) -> AgentState:
    """date_start가 없으면 interrupt로 멈추고 사용자 입력을 기다린다 (Fridge schedule.date_start는 NOT NULL).
    이번 턴에 단일 일정이 추출되지 않았으면(루틴 전용 입력 등) 그대로 통과한다."""
    extracted = state.get("extracted")
    if extracted is None:
        return {**state, "refinement_question": None}

    _log_node("RefineSchedule (검사할 추출 데이터)", extracted)

    if extracted.get("date_start"):
        return {**state, "refinement_question": None}

    question = "일정 날짜를 알려주세요. (예: 3월 15일, 내일, 다음 주 화요일)"
    reply = interrupt(question)
    reply_str = reply if isinstance(reply, str) else str(reply or "")
    updated = _apply_user_reply_to_extracted(extracted, reply_str, datetime.now())
    return {
        **state,
        "extracted": updated,
        "user_reply": reply_str,
        "refinement_question": None,
    }


# ---------- 5) RefineRoutine 노드 (Cycle: 완전히 애매한 블록마다 반복 질문) ----------
def refine_routine_node(state: AgentState) -> AgentState:
    """start/end가 둘 다 없는 블록이 남아있는 동안 하나씩 interrupt로 시간을 확인한다."""
    routines = state.get("extracted_routines") or []
    if not routines:
        return {**state, "refinement_question": None}

    while True:
        found = _find_missing_time_block(routines)
        if not found:
            break
        ri, bi = found
        block = routines[ri]["blocks"][bi]
        _log_node("RefineRoutine (시간 확인 필요)", block)

        question = f"'{block.get('label') or '해당 활동'}'의 시작/종료 시간을 알려주세요. (예: 오전 10시~11시)"
        reply = interrupt(question)
        reply_str = reply if isinstance(reply, str) else str(reply or "")
        times = _extract_times_from_reply(reply_str)

        updated_block = dict(block)
        if len(times) >= 2:
            updated_block["start"], updated_block["end"] = times[0], times[1]
        elif len(times) == 1:
            updated_block["start"] = times[0]
            updated_block["end"] = times[0]
        routines[ri]["blocks"][bi] = updated_block

    return {**state, "extracted_routines": routines, "refinement_question": None}


# ---------- 6) Finalize 노드 ----------
def finalize_node(state: AgentState) -> AgentState:
    """단일/다중 일정과 루틴 추출 결과를 최종 반환 스키마로 모은다."""
    extracted_list = state.get("extracted_list") or []
    if extracted_list:
        schedules = extracted_list
    elif state.get("extracted") is not None:
        schedules = [state["extracted"]]
    else:
        schedules = []

    routines = state.get("extracted_routines") or []

    next_state = {**state, "schedules": schedules, "routines": routines}
    _log_node("Finalize", {"schedules": schedules, "routines": routines})
    return next_state


# ---------- 그래프 조립 ----------
def build_graph() -> StateGraph:
    builder = StateGraph(AgentState)

    builder.add_node("plan", plan_node)
    builder.add_node("classify_intent", classify_intent_node)
    builder.add_node("execute", execute_node)
    builder.add_node("refine_schedule", refine_schedule_node)
    builder.add_node("refine_routine", refine_routine_node)
    builder.add_node("finalize", finalize_node)

    builder.add_edge(START, "plan")
    builder.add_edge("plan", "classify_intent")
    builder.add_edge("classify_intent", "execute")
    builder.add_conditional_edges(
        "execute",
        _route_after_execute,
        {"refine_schedule": "refine_schedule", "refine_routine": "refine_routine"},
    )
    builder.add_edge("refine_schedule", "refine_routine")
    builder.add_edge("refine_routine", "finalize")
    builder.add_edge("finalize", END)

    return builder


# interrupt 후 재개를 위해 메모리 체크포인터가 필요
memory = MemorySaver()
app = build_graph().compile(checkpointer=memory)


def run_agent(
    user_text: Optional[str] = None,
    image_path: Optional[str] = None,
    thread_id: str = "default",
) -> dict:
    config = {"configurable": {"thread_id": thread_id}}
    initial: AgentState = {
        "user_text": user_text or "",
        "image_path": image_path,
    }
    return app.invoke(initial, config=config)


def run_agent_resume(thread_id: str, user_reply: str) -> dict:
    config = {"configurable": {"thread_id": thread_id}}
    return app.invoke(Command(resume=user_reply), config=config)


# ---------- CLI 예시 (직접 실행 시, 로컬 디버깅용) ----------
if __name__ == "__main__":
    import sys

    thread_id = "cli-1"
    if len(sys.argv) > 1 and sys.argv[1] == "--resume":
        if len(sys.argv) < 4:
            print("사용법: python agent.py --resume <thread_id> <답변>")
            sys.exit(1)
        out = run_agent_resume(thread_id=sys.argv[2], user_reply=sys.argv[3])
        if out.get("__interrupt__"):
            print("질문:", out["__interrupt__"])
        else:
            print("일정:", json.dumps(out.get("schedules"), ensure_ascii=False, indent=2))
            print("루틴:", json.dumps(out.get("routines"), ensure_ascii=False, indent=2))
        sys.exit(0)

    text = sys.argv[1] if len(sys.argv) > 1 else "다음 주 화요일 오후 2시 소풍, 준비물: 도시락, 물"
    out = run_agent(user_text=text, thread_id=thread_id)
    if out.get("__interrupt__"):
        print("질문:", out["__interrupt__"])
        print("답변 후 재개: python agent.py --resume", thread_id, "<답변>")
    else:
        print("일정:", json.dumps(out.get("schedules"), ensure_ascii=False, indent=2))
        print("루틴:", json.dumps(out.get("routines"), ensure_ascii=False, indent=2))
