"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { IconCamera, IconPhotoScan, IconLoader2, IconX } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SheetHeader, SheetHeaderAction } from "@/components/ui/SheetHeader";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { addNotice, updateNotice } from "@/app/(main)/board/actions";
import { createClient } from "@/lib/supabase/client";
import { extractTextFromImage } from "@/lib/agentApi";
import { compressImage } from "@/lib/imageCompress";
import type { Notice, NoticeType } from "@/types";

const STICKER_COLORS = ["#FFF9C4", "#FFE0E0", "#E1F5EE", "#E3E8FF", "#F3E1FF"];

/** 스티커("하고싶은 말")/메모(구 공지 포함) 작성·수정 겸용 시트 — 게시판 탭과 홈(스티커
 * 수정 진입점) 양쪽에서 공용으로 쓴다. */
export function AddPostSheet({
  open,
  onClose,
  workspaceId,
  currentUserId,
  fixedType,
  initialType,
  existingNotice,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  currentUserId: string;
  /** 지정하면 타입 선택 UI를 숨기고 이 타입으로 고정 (예: "하고싶은 말" 작성 버튼) */
  fixedType?: NoticeType;
  /** fixedType이 없을 때(메모/공지 작성 버튼) 기본 선택 타입 — 픽커는 항상 메모/공지만 보여줌 */
  initialType?: NoticeType;
  /** 지정하면 수정 모드로 열림 — 기존 내용으로 채우고 저장 시 새로 만들지 않고 updateNotice로 반영 */
  existingNotice?: Notice | null;
}) {
  const { showToast } = useToast();
  const [type, setType] = useState<NoticeType>(fixedType ?? initialType ?? "memo");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState(STICKER_COLORS[0]);
  const [expireDays, setExpireDays] = useState(1);
  const [isPinned, setIsPinned] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [isPending, startTransition] = useTransition();

  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // 시트가 열릴 때마다(수정 대상이 바뀔 때 포함) 필드를 다시 채운다 — 시트 자체는
  // 계속 마운트된 채 open만 토글되므로, 최초 마운트 시 useState 초기값만으로는
  // "추가"→"수정"으로 열릴 때 이전 내용이 남는 문제가 생긴다.
  useEffect(() => {
    if (!open) return;
    if (existingNotice) {
      setType(existingNotice.type);
      setTitle(existingNotice.title ?? "");
      setContent(existingNotice.content);
      setColor(existingNotice.color);
      setImageUrl(existingNotice.image_url);
      setIsPinned(existingNotice.is_pinned);
    } else {
      setType(fixedType ?? initialType ?? "memo");
      setTitle("");
      setContent("");
      setColor(STICKER_COLORS[0]);
      setExpireDays(1);
      setIsPinned(false);
      setImageUrl(null);
    }
    setAttachError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingNotice, fixedType, initialType]);

  /** 이미지 삽입 — 스티키(사진 첨부)와 메모/공지(이미지 삽입) 둘 다에서 공용으로 쓰는 업로드 핸들러. */
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAttachError("");
    if (!file.type.startsWith("image/")) {
      setAttachError("이미지 파일만 첨부할 수 있어요.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const supabase = createClient();
      const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : "png";
      const path = `${currentUserId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("notice-images")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("notice-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err) {
      setAttachError(err instanceof Error ? `업로드에 실패했어요: ${err.message}` : "업로드에 실패했어요.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleOcrImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAttachError("");
    if (!file.type.startsWith("image/")) {
      setAttachError("이미지 파일만 첨부할 수 있어요.");
      return;
    }

    setIsExtractingText(true);
    try {
      const dataUrl = await compressImage(file);
      const text = await extractTextFromImage(dataUrl);
      if (text.trim()) {
        setContent((prev) => (prev ? `${prev}\n${text.trim()}` : text.trim()));
      } else {
        setAttachError("이미지에서 텍스트를 찾지 못했어요.");
      }
    } catch (err) {
      setAttachError(
        err instanceof Error && err.message && !err.message.startsWith("agent_http_")
          ? err.message
          : "텍스트 추출에 실패했어요."
      );
    } finally {
      setIsExtractingText(false);
    }
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    startTransition(async () => {
      if (existingNotice) {
        const result = await updateNotice(existingNotice.id, {
          type: type !== "sticky" ? type : undefined,
          title: type === "sticky" ? undefined : title,
          content,
          color: type === "sticky" ? color : undefined,
          isPinned: type !== "sticky" ? isPinned : undefined,
          imageUrl,
        });
        if (!result.ok) {
          showToast(result.message);
          return;
        }
      } else {
        await addNotice(workspaceId, {
          type,
          title: type === "sticky" ? undefined : title,
          content,
          color: type === "sticky" ? color : undefined,
          isPinned: type !== "sticky" ? isPinned : undefined,
          expireDays: type === "sticky" ? expireDays : undefined,
          imageUrl,
        });
      }
      onClose();
    });
  };

  const sheetTitle = existingNotice
    ? type === "sticky"
      ? "하고싶은 말 수정"
      : "메모 수정"
    : type === "sticky"
    ? "하고싶은 말 작성"
    : "메모 작성";

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <SheetHeader title={sheetTitle}>
          <SheetHeaderAction
            label={existingNotice ? "저장" : "등록"}
            onClick={handleSubmit}
            disabled={isPending || !content.trim()}
          />
        </SheetHeader>

        {type === "sticky" ? (
          <>
            <div className="flex gap-2">
              {STICKER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full ${
                    color === c ? "ring-2 ring-ink ring-offset-2" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="자유롭게 적어보세요"
              rows={3}
              className="rounded-xl p-3 text-[17px]"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => imageFileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="flex items-center gap-1.5 text-[16px] font-medium text-honey disabled:opacity-50"
              >
                {isUploadingImage ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconCamera size={16} />
                )}
                {imageUrl ? "사진 변경" : "사진 첨부"}
              </button>
              {imageUrl && (
                <div className="relative h-10 w-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <button
                    onClick={() => setImageUrl(null)}
                    aria-label="사진 제거"
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-cream"
                  >
                    <IconX size={10} />
                  </button>
                </div>
              )}
            </div>
            {!existingNotice && (
              <div className="flex gap-2">
                {[1, 2, 3].map((d) => (
                  <button
                    key={d}
                    onClick={() => setExpireDays(d)}
                    className={`rounded-full px-3 py-1.5 text-[16px] font-medium ${
                      expireDays === d ? "bg-ink text-cream" : "bg-cream text-stone"
                    }`}
                  >
                    {d}일
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="h-11 rounded-xl px-3 text-[17px]"
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요"
              rows={4}
              className="rounded-xl p-3 text-[17px]"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => imageFileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="flex items-center gap-1.5 text-[16px] font-medium text-honey disabled:opacity-50"
              >
                {isUploadingImage ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconCamera size={16} />
                )}
                {imageUrl ? "이미지 변경" : "이미지 삽입"}
              </button>
              {imageUrl && (
                <div className="relative h-10 w-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <button
                    onClick={() => setImageUrl(null)}
                    aria-label="이미지 제거"
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-cream"
                  >
                    <IconX size={10} />
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => ocrFileInputRef.current?.click()}
              disabled={isExtractingText}
              className="flex items-center gap-1.5 self-start text-[16px] font-medium text-honey disabled:opacity-50"
            >
              {isExtractingText ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconPhotoScan size={16} />
              )}
              {isExtractingText ? "텍스트를 읽는 중..." : "사진에서 텍스트 채우기"}
            </button>
            <input
              ref={ocrFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleOcrImageSelected}
            />
            <label className="flex items-center gap-2 text-[16px] text-ink">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
              />
              상단 고정
            </label>
          </>
        )}
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelected}
        />

        {attachError && <p className="text-[14px] text-terra">{attachError}</p>}
      </div>
    </BottomSheet>
  );
}
