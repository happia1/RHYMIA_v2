"use client";

import { useMemo, useState } from "react";
import { IconCheck } from "@tabler/icons-react";

const ROWS = 8;

/** 표준 사다리타기 생성 — 각 행에서 인접한 두 줄을 잇는 가로선(rung)을 무작위로 배치하되,
 * 같은 행에서 가로선이 겹치지 않도록(한 칸 건너뛰기) 한다. */
function generateRungs(cols: number): boolean[][] {
  const rungs: boolean[][] = Array.from({ length: ROWS }, () => Array(Math.max(cols - 1, 0)).fill(false));
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < cols - 1) {
      if (Math.random() < 0.5) {
        rungs[r][c] = true;
        c += 2;
      } else {
        c += 1;
      }
    }
  }
  return rungs;
}

function traceLadder(rungs: boolean[][], startCol: number): number {
  let col = startCol;
  for (const row of rungs) {
    if (row[col]) col += 1;
    else if (col > 0 && row[col - 1]) col -= 1;
  }
  return col;
}

/** 세로줄 중 하나를 고르면 사다리를 타고 내려가 도착하는 후보를 랜덤으로 알려주는 범용 사다리타기. */
export function LadderGame({
  candidates,
  onSelect,
  isPending,
  actionLabel = "이걸로 할래요",
}: {
  candidates: string[];
  onSelect: (item: string) => void;
  isPending?: boolean;
  actionLabel?: string;
}) {
  const cols = candidates.length;
  const rungs = useMemo(() => generateRungs(cols), [cols]);
  const [startCol, setStartCol] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const resultCol = startCol !== null ? traceLadder(rungs, startCol) : null;

  const pickStart = (col: number) => {
    if (startCol !== null) return;
    setStartCol(col);
    setThinking(true);
    setRevealed(false);
    setTimeout(() => {
      setThinking(false);
      setRevealed(true);
    }, 700);
  };

  const reset = () => {
    setStartCol(null);
    setThinking(false);
    setRevealed(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between gap-1">
        {candidates.map((_, i) => (
          <button
            key={i}
            onClick={() => pickStart(i)}
            disabled={startCol !== null}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-medium disabled:opacity-40 ${
              startCol === i ? "bg-honey text-white" : "bg-cream text-stone"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="relative h-32 w-full">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className={`absolute top-0 h-full w-px ${
              revealed && (i === startCol || i === resultCol) ? "bg-honey" : "bg-border-light"
            }`}
            style={{ left: `${(i / (cols - 1)) * 100}%` }}
          />
        ))}
        {rungs.map((row, r) =>
          row.map((has, c) =>
            has ? (
              <div
                key={`${r}-${c}`}
                className="absolute h-px bg-border-light"
                style={{
                  top: `${(r / (ROWS - 1)) * 100}%`,
                  left: `${(c / (cols - 1)) * 100}%`,
                  width: `${(1 / (cols - 1)) * 100}%`,
                }}
              />
            ) : null
          )
        )}
      </div>

      <div className="flex justify-between gap-1">
        {candidates.map((label, i) => (
          <span
            key={i}
            className={`flex-1 truncate px-0.5 text-center text-[13px] ${
              revealed && i === resultCol ? "font-medium text-honey" : "text-[var(--text-muted)]"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {thinking && (
        <p className="text-center text-[14px] text-[var(--text-muted)]">결과 확인 중...</p>
      )}

      {revealed && resultCol !== null && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-[19px] font-medium text-ink">{candidates[resultCol]}</span>
          <div className="flex w-full gap-2">
            <button
              onClick={reset}
              className="flex-1 rounded-xl bg-cream py-2.5 text-[16px] font-medium text-stone"
            >
              다시
            </button>
            <button
              onClick={() => onSelect(candidates[resultCol])}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-honey py-2.5 text-[16px] font-medium text-white disabled:opacity-50"
            >
              <IconCheck size={15} /> {actionLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
