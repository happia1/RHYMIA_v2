"use client";

import { useEffect, useState } from "react";

const ROTATE_MS = 5000;

/** 태블릿 홈 중앙 포토 프레임 — 사진이 여러 장이면 5초 간격으로 무작위 전환(연속으로 같은
 * 사진이 두 번 나오지만 않게). 프레임 배경은 페이지 배경(--bg-page)과 정확히 같은 색이라야
 * 사진이 없을 때 "그 부분만 도드라진 검정 사각형"처럼 보이지 않는다 — 가장자리가 배경에
 * 녹아드는 box-shadow 블러도 같은 이유로 --bg-page 색으로 맞춘다(다른 색이면 블러 자체가
 * 티가 남). 다크 단일 테마라 지금은 결과적으로 거의 검정에 가깝지만, 하드코딩된 색이 아니라
 * 테마 변수를 참조하므로 라이트 재도입 시에도 자동으로 페이지 배경과 맞아떨어진다. */
export function HomePhotoFrame({ photoUrls }: { photoUrls: string[] }) {
  const [index, setIndex] = useState(0);

  // 자동 전환 타이머를 index에도 반응하게 해서, 탭으로 수동 전환하면 그 시점부터 다시
  // 5초를 새로 센다(막 넘긴 직후 자동 전환이 곧바로 겹쳐 오는 어색함을 방지).
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
  }, [photoUrls.length, index]);

  if (photoUrls.length === 0) {
    return <div className="h-full w-full bg-[var(--bg-page)]" />;
  }

  const safeIndex = index % photoUrls.length;
  const current = photoUrls[safeIndex];

  // 탭하면 다음 사진으로 바로 전환 — 자동 회전은 무작위지만, 사람이 직접 넘길 땐 예측
  // 가능하게 순서대로(다음 인덱스) 넘어가는 게 자연스럽다.
  const handleTap = () => {
    if (photoUrls.length <= 1) return;
    setIndex((prev) => (prev + 1) % photoUrls.length);
  };

  return (
    <div
      onClick={handleTap}
      className={`relative flex h-full w-full items-center justify-center bg-[var(--bg-page)] ${
        photoUrls.length > 1 ? "cursor-pointer" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current}
        src={current}
        alt=""
        className="h-[76%] w-[84%] rounded-2xl object-cover"
        style={{
          boxShadow: "0 0 56px 42px var(--bg-page)",
          animation: "photo-fade-in 700ms ease",
        }}
      />
      {photoUrls.length > 1 && (
        // 점 인디케이터는 프레임 배경(--bg-page, 다크 기준 거의 검정) 위에서 항상 또렷하게
        // 보여야 하는 고정 회색 — 테마가 바뀌어도 이 어두운 프레임 위에서는 그대로 잘 보인다.
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
