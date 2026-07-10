"use client";

import { useEffect, useState } from "react";
import { STATUS_COLOR_VAR, DEFAULT_STATUS_COLOR_VAR } from "@/lib/routineColors";
import type { RoutineBlock } from "@/types";

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 내 루틴 화면 상단의 24시간 도넛형 시각화. 보기 전용 — 블록은 여기서 편집하지 않고
 * 아래 폼/리스트로 편집하며, 이 차트는 결과를 즉시 반영해서 보여주기만 한다.
 * size로 크기를 조절할 수 있어(비율은 고정, 220px 기준) 일정 탭 상단 위젯 등 더 작은
 * 자리에서도 재사용한다. */
export function RoutineWheel({
  blocks,
  highlightedIndex,
  onSelectBlock,
  size = 220,
}: {
  blocks: RoutineBlock[];
  highlightedIndex: number | null;
  onSelectBlock: (index: number | null) => void;
  size?: number;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const CENTER = size / 2;
  const RADIUS = size * 0.4;
  const STROKE = size * (20 / 220);
  const FONT_SIZE = size * (20 / 220);

  function polarToXY(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: CENTER + radius * Math.sin(rad),
      y: CENTER - radius * Math.cos(rad),
    };
  }

  // 자정=12시 방향(각도 0), 시계 방향으로 진행하는 아크 path. endAngle이 360을 넘어도
  // (자정을 가로지르는 블록) 좌표는 mod 360으로, 방향/크기는 실제 각도차로 계산한다.
  function describeArc(startAngle: number, endAngle: number, radius: number) {
    const start = polarToXY(startAngle % 360, radius);
    const end = polarToXY(endAngle % 360, radius);
    const sweep = endAngle - startAngle;
    const largeArcFlag = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  }

  const nowAngle = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 360;
  const needleEnd = polarToXY(nowAngle, RADIUS + STROKE / 2 + 6);
  const needleStart = polarToXY(nowAngle, size * (16 / 220));

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth={STROKE}
        />

        {blocks.map((b, i) => {
          let startMin = timeToMinutes(b.start);
          let endMin = timeToMinutes(b.end);
          if (endMin <= startMin) endMin += 24 * 60;
          const startAngle = (startMin / 1440) * 360;
          const endAngle = (endMin / 1440) * 360;
          const colorVar = STATUS_COLOR_VAR[b.status] ?? DEFAULT_STATUS_COLOR_VAR;
          const isHighlighted = highlightedIndex === i;
          const isDimmed = highlightedIndex !== null && !isHighlighted;
          return (
            <path
              key={`${b.start}-${b.end}-${i}`}
              d={describeArc(startAngle, endAngle, RADIUS)}
              fill="none"
              stroke={`var(${colorVar})`}
              strokeWidth={isHighlighted ? STROKE + 6 : STROKE}
              strokeLinecap="round"
              opacity={isDimmed ? 0.35 : 1}
              onClick={() => onSelectBlock(isHighlighted ? null : i)}
              className="cursor-pointer transition-all"
            />
          );
        })}

        {[0, 6, 12, 18].map((h) => {
          const angle = (h / 24) * 360;
          const inner = polarToXY(angle, RADIUS - STROKE / 2 - 7);
          const outer = polarToXY(angle, RADIUS - STROKE / 2 - 3);
          return (
            <line
              key={h}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--text-muted)"
              strokeWidth={1.5}
            />
          );
        })}

        <line
          x1={needleStart.x}
          y1={needleStart.y}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke="var(--accent-honey)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={CENTER} cy={CENTER} r={3} fill="var(--accent-honey)" />

        <text
          x={CENTER}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={FONT_SIZE}
          fontWeight={300}
          fill="var(--text-primary)"
        >
          {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
        </text>
      </svg>
    </div>
  );
}
