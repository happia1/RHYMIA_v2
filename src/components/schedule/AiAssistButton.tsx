"use client";

import { IconSparkles } from "@tabler/icons-react";

// TODO: 텍스트/이미지/문서를 분석해 일정을 자동 생성하는 AI Agent 연결 지점.
// 현재는 기능 없이 자리만 차지하는 플레이스홀더입니다.
export function AiAssistButton({ onClick = () => {} }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-[148px] right-6 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-md"
      aria-label="AI로 일정 만들기"
    >
      <IconSparkles size={20} />
    </button>
  );
}
