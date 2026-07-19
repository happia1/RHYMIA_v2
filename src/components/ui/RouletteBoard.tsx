"use client";

import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";

/** 후보 풀을 그리드로 보여주고 하이라이트가 점점 느려지며 한 곳에 멈추는 방식으로
 * 랜덤 선택을 연출하는 범용 룰렛 — "오늘 뭐먹지"/"오늘 뭐하지" 양쪽에서 재사용. */
export function RouletteBoard({
  pool,
  onSelect,
  isPending,
  actionLabel = "이걸로 할래요",
}: {
  pool: string[];
  onSelect: (item: string) => void;
  isPending?: boolean;
  actionLabel?: string;
}) {
  const [spinning, setSpinning] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [resultIndex, setResultIndex] = useState<number | null>(null);

  const spin = () => {
    setSpinning(true);
    setResultIndex(null);
    const finalIndex = Math.floor(Math.random() * pool.length);
    const totalSteps = pool.length * 3 + finalIndex;
    let step = 0;
    const tick = () => {
      setHighlightIndex(step % pool.length);
      step++;
      if (step <= totalSteps) {
        const delay = 60 + (step / totalSteps) * 180;
        setTimeout(tick, delay);
      } else {
        setHighlightIndex(finalIndex);
        setResultIndex(finalIndex);
        setSpinning(false);
      }
    };
    tick();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {pool.map((item, i) => (
          <div
            key={item}
            className={`flex h-14 items-center justify-center rounded-xl px-2 text-center text-[16px] font-medium transition-colors ${
              highlightIndex === i ? "bg-honey text-white" : "bg-cream text-ink"
            }`}
          >
            {item}
          </div>
        ))}
      </div>

      {resultIndex === null ? (
        <button
          onClick={spin}
          disabled={spinning}
          className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[18px] font-medium text-cream disabled:opacity-50"
        >
          {spinning ? "돌아가는 중..." : "룰렛 돌리기"}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={spin}
            className="flex-1 rounded-xl bg-cream py-3 text-[16px] font-medium text-stone"
          >
            다시
          </button>
          <button
            onClick={() => onSelect(pool[resultIndex])}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-honey py-3 text-[16px] font-medium text-white disabled:opacity-50"
          >
            <IconCheck size={15} /> {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
