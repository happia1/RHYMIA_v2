"use client";

import { useEffect, useState } from "react";

const ROTATE_MS = 5000;

/** 태블릿 홈 중앙 포토 프레임 — 사진이 여러 장이면 5초 간격으로 무작위 전환(연속으로 같은
 * 사진이 두 번 나오지만 않게). 가장자리가 배경에 녹아드는 효과는 box-shadow 블러로
 * 처리하는데, 이 블러가 실제로 "배경에 녹아 보이려면" 프레임 바깥 배경과 같은 색이어야
 * 하므로 사진 유무와 무관하게 프레임 전체를 검정(bg-black)으로 고정한다 — TV/액자 베젤처럼
 * 테마 토큰(--bg-page 등)과 무관하게 항상 검정이어야 하는 의도된 예외(사진이 없을 때
 * "순수 블랙 여백" 요구사항과도 같은 맥락). 사진이 하나도 없으면 그 검정 배경만 남는다. */
export function HomePhotoFrame({ photoUrls }: { photoUrls: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photoUrls.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        let next = Math.floor(Math.random() * photoUrls.length);
        if (next === prev) next = (next + 1) % photoUrls.length;
        return next;
      });
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [photoUrls.length]);

  if (photoUrls.length === 0) {
    return <div className="h-full w-full bg-black" />;
  }

  const safeIndex = index % photoUrls.length;
  const current = photoUrls[safeIndex];

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current}
        src={current}
        alt=""
        className="h-[76%] w-[84%] rounded-2xl object-cover"
        style={{ boxShadow: "0 0 56px 42px #000", animation: "photo-fade-in 700ms ease" }}
      />
      {photoUrls.length > 1 && (
        // 프레임 자체가 테마 토큰과 무관하게 항상 검정이라(위 주석 참고), 여기 점 색상도
        // 앱의 테마 변수가 아니라 검정 배경 위에서 항상 또렷한 고정 회색을 그대로 쓴다.
        <div className="absolute bottom-[6%] flex gap-1.5">
          {photoUrls.map((url, i) => (
            <span
              key={url}
              className={`h-[3px] rounded-full transition-all ${
                i === safeIndex ? "w-3.5 bg-[#8A8A93]" : "w-1 bg-[#3A3A42]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
