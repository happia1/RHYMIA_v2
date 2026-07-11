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

function SortableItem({
  id,
  editMode,
  children,
}: {
  id: HomeSectionId;
  editMode: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editMode });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-2 transition-transform duration-200 ${
        editMode ? "scale-[0.97]" : ""
      } ${isDragging ? "z-10 scale-[1.02] opacity-50" : ""}`}
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
            className={`text-[13px] font-medium ${mirror.primary}`}
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
          {/* 4개 위젯을 2열 그리드에 자동 배치 — 드래그로 순서를 바꾸면 어떤 2개가
              나란히(같은 행) 붙을지, 어떤 게 위아래로 쌓일지(다른 행)가 함께 바뀐다. */}
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-section">
              {order.map((id, index) => (
                <Fragment key={id}>
                  {index === 2 && (
                    <div className={`col-span-2 h-px w-full ${mirror.hairlineBg}`} />
                  )}
                  <SortableItem id={id} editMode={editMode}>
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
