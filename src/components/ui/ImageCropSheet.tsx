"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SheetHeader, SheetHeaderAction } from "@/components/ui/SheetHeader";

const OUTPUT_LONG_SIDE = 1080;
const JPEG_QUALITY = 0.9;
const MAX_USER_SCALE = 4;

export type CropRatioOption = { label: string; value: number };

type Offset = { x: number; y: number };

/** 업로드 전 크롭 편집 — 프레임(원형/사각형)은 화면에 고정하고, 사진 쪽을 드래그로
 * 옮기거나 휠/핀치로 확대해서 프레임 안에 담을 부분을 고르는 방식(인스타그램 프로필
 * 편집과 동일한 상호작용). 프레임은 항상 사각형 픽셀을 캡처하고, 원형 미리보기는
 * CSS 오버레이일 뿐이다 — 실제 원형 표시는 각 화면의 Avatar(rounded-full)가 담당하므로
 * 여기서는 정사각형만 정확히 잘라내면 된다. 최종 출력은 canvas에서 다시 인코딩되므로
 * (긴 변 {@link OUTPUT_LONG_SIDE}px, JPEG {@link JPEG_QUALITY}) 별도의 imageCompress
 * 호출 없이 이 컴포넌트를 거치는 것 자체가 압축 단계를 겸한다. */
export function ImageCropSheet({
  open,
  file,
  shape,
  ratioOptions,
  title = "사진 편집",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  file: File | null;
  shape: "circle" | "rect";
  /** shape="rect"일 때만 사용 — 여러 비율 중 고를 수 있게(첫 값이 기본 선택) */
  ratioOptions?: CropRatioOption[];
  title?: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [ratioIndex, setRatioIndex] = useState(0);
  const [userScale, setUserScale] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const aspect = shape === "circle" ? 1 : ratioOptions?.[ratioIndex]?.value ?? 1;

  // 파일이 바뀔 때마다 새 object URL을 만들고, 편집 상태(줌/오프셋)를 초기화한다.
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setNaturalSize({ width: 0, height: 0 });
    setUserScale(1);
    setOffset({ x: 0, y: 0 });
    setRatioIndex(0);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useLayoutEffect(() => {
    if (!open || !stageRef.current) return;
    const el = stageRef.current;
    const measure = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  const frame = useMemo(() => {
    if (!stageSize.width || !stageSize.height) return { width: 0, height: 0 };
    let width = Math.min(stageSize.width * 0.86, 420);
    let height = width / aspect;
    const maxHeight = stageSize.height * 0.68;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }
    return { width, height };
  }, [stageSize, aspect]);

  const baseScale = useMemo(() => {
    if (!naturalSize.width || !frame.width) return 1;
    return Math.max(frame.width / naturalSize.width, frame.height / naturalSize.height);
  }, [naturalSize, frame]);

  const displayScale = baseScale * userScale;
  const displayWidth = naturalSize.width * displayScale;
  const displayHeight = naturalSize.height * displayScale;

  const clampOffset = useCallback(
    (next: Offset, scale: number) => {
      const dw = naturalSize.width * scale;
      const dh = naturalSize.height * scale;
      const maxX = Math.max(0, (dw - frame.width) / 2);
      const maxY = Math.max(0, (dh - frame.height) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [naturalSize, frame]
  );

  const applyScale = useCallback(
    (nextUserScale: number) => {
      const clampedScale = Math.min(MAX_USER_SCALE, Math.max(1, nextUserScale));
      setUserScale(clampedScale);
      setOffset((prev) => clampOffset(prev, baseScale * clampedScale));
    },
    [baseScale, clampOffset]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchStart.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: userScale,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const prevPoint = pointers.current.get(e.pointerId);
    if (!prevPoint) return;
    const current = { x: e.clientX, y: e.clientY };

    if (pointers.current.size === 2 && pinchStart.current) {
      pointers.current.set(e.pointerId, current);
      const [a, b] = Array.from(pointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const nextScale = pinchStart.current.scale * (distance / pinchStart.current.distance);
      applyScale(nextScale);
      return;
    }

    if (pointers.current.size === 1) {
      const dx = current.x - prevPoint.x;
      const dy = current.y - prevPoint.y;
      pointers.current.set(e.pointerId, current);
      setOffset((prev) => clampOffset({ x: prev.x + dx, y: prev.y + dy }, displayScale));
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    // 남은 손가락 하나로 계속 드래그할 수 있게 기준점을 다시 잡는다.
    if (pointers.current.size === 1) {
      const [id, point] = Array.from(pointers.current.entries())[0];
      pointers.current.set(id, point);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    applyScale(userScale * (1 - e.deltaY * 0.001));
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !naturalSize.width) return;

    const relX = displayWidth / 2 - frame.width / 2 - offset.x;
    const relY = displayHeight / 2 - frame.height / 2 - offset.y;
    const sx = relX / displayScale;
    const sy = relY / displayScale;
    const sw = frame.width / displayScale;
    const sh = frame.height / displayScale;

    const outWidth = aspect >= 1 ? OUTPUT_LONG_SIDE : Math.round(OUTPUT_LONG_SIDE * aspect);
    const outHeight = aspect >= 1 ? Math.round(OUTPUT_LONG_SIDE / aspect) : OUTPUT_LONG_SIDE;

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outWidth, outHeight);

    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  };

  if (!open || !file || !objectUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
        <SheetHeader title={title}>
          <SheetHeaderAction label="취소" tone="stone" onClick={onCancel} />
          <SheetHeaderAction label="완료" onClick={handleConfirm} />
        </SheetHeader>
      </div>

      <div
        ref={stageRef}
        className="relative flex flex-1 touch-none items-center justify-center overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={handleWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={objectUrl}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget;
            setNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
          }}
          className="pointer-events-none absolute select-none"
          style={{
            width: displayWidth || undefined,
            height: displayHeight || undefined,
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
          }}
        />
        {frame.width > 0 && (
          <div
            className={`pointer-events-none absolute border-2 border-white/90 ${
              shape === "circle" ? "rounded-full" : "rounded-2xl"
            }`}
            style={{
              width: frame.width,
              height: frame.height,
              boxShadow: "0 0 0 2000px rgba(0,0,0,0.55)",
            }}
          />
        )}
      </div>

      {ratioOptions && ratioOptions.length > 1 && (
        <div className="flex justify-center gap-2 px-6 pb-2">
          {ratioOptions.map((opt, i) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setRatioIndex(i)}
              className={`rounded-full px-4 py-1.5 text-[14px] font-medium ${
                i === ratioIndex ? "bg-honey text-white" : "bg-white/10 text-white/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <p className="px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 text-center text-[13px] text-white/50">
        드래그해서 위치를 옮기고, 두 손가락(또는 휠)으로 확대·축소하세요
      </p>
    </div>
  );
}
