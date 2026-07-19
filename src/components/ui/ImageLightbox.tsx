"use client";

import { IconX } from "@tabler/icons-react";

/** 이미지 원본을 화면 전체에 비율 유지(object-contain)로 크게 보여주는 최소 뷰어 —
 * 배경/닫기 버튼 어디를 탭해도 닫힌다. 확대/이동 없이 "원본 크게 보기"만 담당한다. */
export function ImageLightbox({
  imageUrl,
  onClose,
}: {
  imageUrl: string | null;
  onClose: () => void;
}) {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <IconX size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
