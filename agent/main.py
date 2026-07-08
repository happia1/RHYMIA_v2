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
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agent import run_agent, run_agent_resume

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


class ProcessScheduleRequest(BaseModel):
    user_text: Optional[str] = Field(None, description="일정 텍스트")
    image_base64: Optional[str] = Field(None, description="이미지 base64 또는 data:image/...;base64,... 문자열")
    thread_id: Optional[str] = Field(None, description="세션 식별자. resume 시 필수")
    user_reply: Optional[str] = Field(None, description="need_input 이후 사용자 답변 (재개 시)")


@app.post(
    "/process-schedule",
    summary="일정 파싱",
    description=(
        "사진 또는 텍스트로 일정을 추출합니다. "
        "완료 시 { status: 'ok', schedules: [...] }, "
        "날짜 등 정보가 부족하면 { status: 'need_input', message, thread_id }를 반환합니다. "
        "need_input 응답을 받으면 같은 thread_id와 user_reply로 다시 요청해 재개하세요."
    ),
)
def process_schedule(body: ProcessScheduleRequest):
    thread_id = body.thread_id or str(uuid.uuid4())

    try:
        if body.user_reply and body.thread_id:
            result = run_agent_resume(thread_id=body.thread_id, user_reply=body.user_reply)
        else:
            image_path = None
            if body.image_base64 and body.image_base64.strip():
                raw = body.image_base64.strip()
                image_path = raw if raw.startswith("data:") else f"data:image/png;base64,{raw}"

            result = run_agent(user_text=body.user_text, image_path=image_path, thread_id=thread_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"에이전트 처리 오류: {e}") from e

    interrupts = result.get("__interrupt__")
    if interrupts:
        first = interrupts[0] if isinstance(interrupts, (list, tuple)) else interrupts
        message = getattr(first, "value", None) or str(first)
        return {"status": "need_input", "message": message, "thread_id": thread_id}

    schedules = result.get("schedules") or []
    return {"status": "ok", "thread_id": thread_id, "schedules": schedules}


@app.get("/health")
def health():
    return {"status": "ok", "service": "fridge-scheduler-agent"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
