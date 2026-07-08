import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

// 색상만 강제하고 크기(높이/모서리/여백/글자크기)는 일부러 넣지 않는다 — Tailwind는 같은
// 카테고리의 유틸리티 클래스가 겹치면 JSX 문자열 순서가 아니라 내부 생성 순서로 승패가
// 갈려서, 기본값과 호출부 className이 같은 카테고리(h-11 vs h-12 등)를 동시에 쓰면 어느
// 쪽이 이길지 예측할 수 없다. 크기는 항상 호출부 className에서 지정한다.
const FIELD_BASE =
  "border border-input-border bg-input text-input-text placeholder:text-input-placeholder focus:outline-none";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_BASE} ${className}`} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${FIELD_BASE} ${className}`} />;
}
