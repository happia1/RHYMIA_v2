# -*- coding: utf-8 -*-
"""
Fridge 일정 파싱 에이전트 (LangGraph 기반)
Plan -> Execute -> (여러 일정: PrepareMulti | 단일: Refine -> ReturnSingle) 구조.
날짜가 없으면 Refine에서 interrupt로 멈추고, 사용자 답변으로 재개(resume)한다.
DB 저장은 하지 않는다 — 파싱 결과만 반환하고, 실제 저장은 Next.js의 createSchedule
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

    extracted: Optional[dict]        # 단일 일정 (Fridge schedule 스키마)
    extracted_list: Optional[list]   # 여러 일정 (이미지 표/목록 등)

    refinement_question: Optional[str]
    user_reply: Optional[str]

    schedules: Optional[list]        # 최종 반환값 (항상 배열)


# ---------- Fridge schedule 키워드 그룹 (src/lib/scheduleKeywords.ts와 동일하게 유지) ----------
KEYWORD_GROUPS: dict[str, list[str]] = {
    "공휴일": ["법정공휴일", "대체공휴일"],
    "여행": ["국내여행", "해외여행", "당일치기"],
    "행사": ["생일", "기념일", "기일", "결혼식", "장례식"],
    "교육": ["방학", "모의고사", "중간고사", "기말고사", "현장학습", "입학", "졸업"],
    "건강": ["병원", "검진", "예방접종"],
    "기타": [],
}


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


def _parse_schedule_json(text: str, now: datetime) -> dict | list:
    """LLM 출력에서 JSON(단일 객체 또는 배열)만 골라 파싱 후 정규화. 실패하면 기본값."""
    stripped = text
    if "```" in stripped:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", stripped)
        if match:
            stripped = match.group(1).strip()
    try:
        data = json.loads(stripped)
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


# ---------- 1) Plan 노드 ----------
def plan_node(state: AgentState) -> AgentState:
    """입력이 이미지인지 텍스트인지 구분한다."""
    user_text = state.get("user_text")
    image_path = state.get("image_path")

    if image_path and (image_path.startswith("data:") or os.path.isfile(image_path)):
        input_type: Literal["image", "text"] = "image"
    else:
        input_type = "text"

    next_state = {**state, "input_type": input_type}
    _log_node("Plan", {"input_type": input_type})
    return next_state


# ---------- 2) Execute 노드 ----------
def execute_node(state: AgentState) -> AgentState:
    """Gemini 2.5 Flash로 이미지 또는 텍스트에서 일정 정보를 추출한다."""
    now = datetime.now()
    user_reply = state.get("user_reply")

    # Refine에서 질문한 뒤 받은 답변으로 기존 추출 결과 보완 (재추출하지 않음)
    if user_reply and state.get("extracted"):
        extracted = _apply_user_reply_to_extracted(state["extracted"], user_reply, now)
        next_state = {**state, "extracted": extracted, "extracted_list": None}
        _log_node("Execute (사용자 답변 반영)", extracted)
        return next_state

    image_path = state.get("image_path")
    user_text = state.get("user_text") or ""
    image_available = bool(image_path) and (
        image_path.startswith("data:") or os.path.isfile(image_path)
    )

    raw = _extract_from_image(image_path, user_text, now) if image_available else _extract_from_text(user_text, now)

    if isinstance(raw, list) and len(raw) > 1:
        next_state = {**state, "extracted": None, "extracted_list": raw}
        _log_node("Execute (여러 일정)", raw)
        return next_state

    single = raw[0] if isinstance(raw, list) else raw
    if not single:
        single = _default_schedule()
    next_state = {**state, "extracted": single, "extracted_list": None}
    _log_node("Execute", single)
    return next_state


def _route_after_execute(state: AgentState) -> Literal["refine", "prepare_multi"]:
    extracted_list = state.get("extracted_list") or []
    return "prepare_multi" if len(extracted_list) > 1 else "refine"


# ---------- 3) Refine 노드 (Cycle: 날짜 없으면 사용자에게 질문) ----------
def refine_node(state: AgentState) -> AgentState:
    """date_start가 없으면 interrupt로 멈추고 사용자 입력을 기다린다 (Fridge schedule.date_start는 NOT NULL)."""
    extracted = state.get("extracted") or _default_schedule()
    _log_node("Refine (검사할 추출 데이터)", extracted)

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


# ---------- 4) 여러 일정 / 단일 일정 반환 노드 ----------
def prepare_multi_node(state: AgentState) -> AgentState:
    """이미지에서 추출한 여러 일정을 그대로 반환 (저장은 사용자 확인 후 Next.js에서)."""
    extracted_list = state.get("extracted_list") or []
    next_state = {**state, "schedules": extracted_list}
    _log_node("PrepareMulti", extracted_list)
    return next_state


def return_single_node(state: AgentState) -> AgentState:
    extracted = state.get("extracted") or _default_schedule()
    next_state = {**state, "schedules": [extracted]}
    _log_node("ReturnSingle", [extracted])
    return next_state


# ---------- 그래프 조립 ----------
def build_graph() -> StateGraph:
    builder = StateGraph(AgentState)

    builder.add_node("plan", plan_node)
    builder.add_node("execute", execute_node)
    builder.add_node("refine", refine_node)
    builder.add_node("return_single", return_single_node)
    builder.add_node("prepare_multi", prepare_multi_node)

    builder.add_edge(START, "plan")
    builder.add_edge("plan", "execute")
    builder.add_conditional_edges(
        "execute", _route_after_execute, {"refine": "refine", "prepare_multi": "prepare_multi"}
    )
    builder.add_edge("refine", "return_single")
    builder.add_edge("return_single", END)
    builder.add_edge("prepare_multi", END)

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
        print(json.dumps(out.get("schedules") or out.get("__interrupt__"), ensure_ascii=False, indent=2))
        sys.exit(0)

    text = sys.argv[1] if len(sys.argv) > 1 else "다음 주 화요일 오후 2시 소풍, 준비물: 도시락, 물"
    out = run_agent(user_text=text, thread_id=thread_id)
    if out.get("__interrupt__"):
        print("질문:", out["__interrupt__"])
        print("답변 후 재개: python agent.py --resume", thread_id, "<답변>")
    else:
        print(json.dumps(out.get("schedules"), ensure_ascii=False, indent=2))
