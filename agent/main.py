# -*- coding: utf-8 -*-
"""
Fridge 일정 파싱 에이전트 FastAPI 진입점.
- POST /process-schedule: 사진/텍스트 -> 에이전트 실행 -> Fridge schedule 스키마 배열 반환
- GET /health: 헬스 체크
"""

from __future__ import annotations

import os
import uuid
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agent import run_agent, run_agent_resume, extract_text_from_image

load_dotenv()

app = FastAPI(
    title="Fridge 일정 파싱 에이전트 API",
    description="가정통신문 이미지 또는 텍스트에서 일정 정보를 추출해 Fridge schedule 테이블 호환 스키마로 반환합니다.",
    version="0.1.0",
)

# ALLOWED_ORIGINS: 콤마로 구분된 도메인 목록. 배포 후 실제 Vercel 도메인을 .env에 추가할 것.
_allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AGENT_API_KEY가 설정된 경우에만 X-API-Key 헤더 검증을 강제한다.
# 미설정(로컬 개발 기본값)이면 인증을 생략 — Next.js 서버(route handler)가 이 서버 앞단에서
# 프록시 역할을 하며 키를 실어 보내므로, 배포 환경에서는 반드시 설정해야 한다.
_AGENT_API_KEY = os.getenv("AGENT_API_KEY")


def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> None:
    if not _AGENT_API_KEY:
        return
    if x_api_key != _AGENT_API_KEY:
        raise HTTPException(status_code=401, detail="유효하지 않은 API 키입니다.")


# image_base64는 원본 이미지 기준 약 8MB까지만 허용 (base64는 원본의 약 4/3배로 부풀려짐).
_MAX_IMAGE_BASE64_LENGTH = 8 * 1024 * 1024 * 4 // 3


def _check_image_size(raw: str) -> None:
    if len(raw) > _MAX_IMAGE_BASE64_LENGTH:
        raise HTTPException(status_code=413, detail="이미지 용량이 너무 큽니다 (최대 8MB).")


class ProcessScheduleRequest(BaseModel):
    user_text: Optional[str] = Field(None, description="일정 텍스트")
    image_base64: Optional[str] = Field(None, description="이미지 base64 또는 data:image/...;base64,... 문자열")
    thread_id: Optional[str] = Field(None, description="세션 식별자. resume 시 필수")
    user_reply: Optional[str] = Field(None, description="need_input 이후 사용자 답변 (재개 시)")


@app.post(
    "/process-schedule",
    summary="일정/루틴 파싱",
    description=(
        "사진 또는 텍스트로 일정 또는 반복되는 하루 일과(루틴)를 추출합니다. "
        "완료 시 { status: 'ok', schedules: [...], routines: [...], target_hint }, "
        "날짜/시간 등 정보가 부족하면 { status: 'need_input', message, thread_id }를 반환합니다. "
        "need_input 응답을 받으면 같은 thread_id와 user_reply로 다시 요청해 재개하세요."
    ),
    dependencies=[Depends(verify_api_key)],
)
def process_schedule(body: ProcessScheduleRequest):
    thread_id = body.thread_id or str(uuid.uuid4())

    image_path = None
    if body.image_base64 and body.image_base64.strip():
        raw = body.image_base64.strip()
        _check_image_size(raw)
        image_path = raw if raw.startswith("data:") else f"data:image/png;base64,{raw}"

    try:
        if body.user_reply and body.thread_id:
            result = run_agent_resume(thread_id=body.thread_id, user_reply=body.user_reply)
        else:
            result = run_agent(user_text=body.user_text, image_path=image_path, thread_id=thread_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"에이전트 처리 오류: {e}") from e

    interrupts = result.get("__interrupt__")
    if interrupts:
        first = interrupts[0] if isinstance(interrupts, (list, tuple)) else interrupts
        message = getattr(first, "value", None) or str(first)
        return {"status": "need_input", "message": message, "thread_id": thread_id}

    schedules = result.get("schedules") or []
    routines = result.get("routines") or []
    target_hint = result.get("routine_target_hint")
    return {
        "status": "ok",
        "thread_id": thread_id,
        "schedules": schedules,
        "routines": routines,
        "target_hint": target_hint,
    }


class ExtractTextRequest(BaseModel):
    image_base64: str = Field(..., description="이미지 base64 또는 data:image/...;base64,... 문자열")


@app.post(
    "/extract-text",
    summary="이미지에서 텍스트 추출",
    description=(
        "메모/공지 작성 시 첨부한 이미지에서 읽을 수 있는 텍스트만 추출해 { text } 로 반환합니다. "
        "일정/루틴 파싱과 달리 아무 스키마 변환 없이 텍스트 그대로 돌려주고, 결과는 저장하지 않습니다."
    ),
    dependencies=[Depends(verify_api_key)],
)
def extract_text(body: ExtractTextRequest):
    raw = (body.image_base64 or "").strip()
    if not raw:
        return {"text": ""}
    _check_image_size(raw)
    image_path = raw if raw.startswith("data:") else f"data:image/png;base64,{raw}"

    try:
        text = extract_text_from_image(image_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"텍스트 추출 오류: {e}") from e

    return {"text": text}


@app.get("/health")
def health():
    return {"status": "ok", "service": "fridge-scheduler-agent"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
