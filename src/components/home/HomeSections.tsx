"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGripVertical } from "@tabler/icons-react";
import { useToast } from "@/components/ui/Toast";
import { updateHomeLayout } from "@/app/(main)/home/actions";
import { mirror } from "@/lib/homeTheme";
import type { HomeSectionId } from "@/lib/homeLayout";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_THRESHOLD = 10;

// "오늘 뭐먹지"/"오늘 뭐하지"는 내용을 풀폭으로 넓게 보여주려고 항상 한 줄 전체를 차지하고
// (세로로 쌓임), "하고싶은 말"/"장바구니"는 기존처럼 2열로 나란히 붙는다.
const FULL_WIDTH_SECTION_IDS: HomeSectionId[] = ["mealToday", "scheduleToday"];

function SortableItem({
  id,
  editMode,
  fullWidth,
  children,
}: {
  id: HomeSectionId;
  editMode: boolean;
  fullWidth: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editMode });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-2 transition-transform duration-200 ${
        fullWidth ? "col-span-2" : ""
      } ${editMode ? "scale-[0.97]" : ""} ${isDragging ? "z-10 scale-[1.02] opacity-50" : ""}`}
    >
      {editMode && (
        <button
          {...attributes}
          {...listeners}
          aria-label="순서 변경"
          className={`mt-1 shrink-0 touch-none ${mirror.muted}`}
        >
          <IconGripVertical size={18} />
        </button>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function HomeSections({
  initialOrder,
  sections,
}: {
  initialOrder: HomeSectionId[];
  sections: Record<HomeSectionId, React.ReactNode>;
}) {
  const { showToast } = useToast();
  const [order, setOrder] = useState<HomeSectionId[]>(initialOrder);
  const [editMode, setEditMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef({ x: 0, y: 0 });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: LONG_PRESS_MS, tolerance: 8 },
    })
  );

  const cancelPress = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const startPress = (e: React.PointerEvent) => {
    if (editMode) return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = setTimeout(() => setEditMode(true), LONG_PRESS_MS);
  };

  const trackMove = (e: React.PointerEvent) => {
    if (!pressTimer.current) return;
    const dx = Math.abs(e.clientX - pressStart.current.x);
    const dy = Math.abs(e.clientY - pressStart.current.y);
    if (dx > MOVE_CANCEL_THRESHOLD || dy > MOVE_CANCEL_THRESHOLD) cancelPress();
  };

  useEffect(() => {
    if (!editMode) return;
    const handleOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditMode(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [editMode]);

  // 맨 앞부터 이어지는 풀폭 섹션 개수 — 그 뒤에서부터가 2열 페어 구간이라 그 경계에 구분선을 그린다.
  let leadingFullWidthCount = 0;
  while (
    leadingFullWidthCount < order.length &&
    FULL_WIDTH_SECTION_IDS.includes(order[leadingFullWidthCount])
  ) {
    leadingFullWidthCount++;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as HomeSectionId);
      const newIndex = prev.indexOf(over.id as HomeSectionId);
      const next = arrayMove(prev, oldIndex, newIndex);
      updateHomeLayout(next).catch(() => showToast("순서 저장에 실패했어요"));
      return next;
    });
  };

  return (
    <div>
      {editMode && (
        <div className="mb-2 flex items-center justify-end">
          <button
            onClick={() => setEditMode(false)}
            className={`text-[16px] font-medium ${mirror.primary}`}
          >
            완료
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        onPointerDown={startPress}
        onPointerMove={trackMove}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {/* "오늘 뭐먹지"/"오늘 뭐하지"는 풀폭으로 쌓이고, "하고싶은 말"/"장바구니"는 2열로
              나란히 붙는다 — 드래그로 순서를 바꿔도 각 섹션의 폭 자체는 유지된다. 구분선은
              (1) 풀폭 섹션끼리 이어지는 사이(예: 뭐먹지/뭐하지)와 (2) 풀폭 구간과 2열 구간의
              경계, 두 자리 모두에 그린다 — 둘 다 "leadingFullWidthCount 이하 인덱스" 조건
              하나로 표현된다. */}
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {order.map((id, index) => (
                <Fragment key={id}>
                  {index > 0 && index <= leadingFullWidthCount && (
                    <div className={`col-span-2 mt-4 h-px w-full ${mirror.hairlineBg}`} />
                  )}
                  <SortableItem id={id} editMode={editMode} fullWidth={FULL_WIDTH_SECTION_IDS.includes(id)}>
                    {sections[id]}
                  </SortableItem>
                </Fragment>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
