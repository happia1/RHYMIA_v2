import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

// 색상만 강제하고 크기(높이/모서리/여백/글자크기)는 일부러 넣지 않는다 — Tailwind는 같은
// 카테고리의 유틸리티 클래스가 겹치면 JSX 문자열 순서가 아니라 내부 생성 순서로 승패가
// 갈려서, 기본값과 호출부 className이 같은 카테고리(h-11 vs h-12 등)를 동시에 쓰면 어느
// 쪽이 이길지 예측할 수 없다. 크기는 항상 호출부 className에서 지정한다.
// variant="underline"은 border-x-0/border-t-0로 다른 방향을 먼저 지워서 boxed의
// "border"와 겹치지 않게 하고, border-b만 남긴다 — 스마트미러 스타일 화면(식탁 탭 등)에서 사용.
const VARIANT_BASE = {
  boxed:
    "border border-input-border bg-input text-input-text placeholder:text-input-placeholder focus:outline-none",
  underline:
    "border-x-0 border-t-0 border-b border-input-border bg-transparent text-input-text placeholder:text-input-placeholder focus:outline-none",
} as const;

type Variant = keyof typeof VARIANT_BASE;

export function Input({
  className = "",
  variant = "boxed",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { variant?: Variant }) {
  return <input {...props} className={`${VARIANT_BASE[variant]} ${className}`} />;
}

export function Textarea({
  className = "",
  variant = "boxed",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { variant?: Variant }) {
  return <textarea {...props} className={`${VARIANT_BASE[variant]} ${className}`} />;
}
