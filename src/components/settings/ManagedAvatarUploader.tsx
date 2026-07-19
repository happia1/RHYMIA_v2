"use client";

import { useRef, useState, useTransition } from "react";
import { IconCamera, IconPhoto } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageCompress";
import { updateManagedMemberAvatar } from "@/app/(main)/settings/actions";
import { MANAGED_AVATAR_TEXT_COLOR } from "@/lib/members";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/** managed 멤버(자녀 등) 프로필 사진 — 계정용 AvatarUploader와 달리 auth.uid()로 소유한
 * 폴더가 없어(계정 자체가 없음) `avatars/managed/{workspaceId}/{memberId}/...` 경로 규칙을
 * 쓴다(스토리지 정책도 이 규칙 기준, supabase/add_managed_avatar_storage.sql). 끼니 등록
 * 화면의 카메라 시트와 같은 톤으로 카메라/앨범 중 고르게 한다. */
export function ManagedAvatarUploader({
  workspaceId,
  memberId,
  displayName,
  avatarColor,
  avatarImageUrl,
}: {
  workspaceId: string;
  memberId: string;
  displayName: string;
  avatarColor: string;
  avatarImageUrl: string | null;
}) {
  const [preview, setPreview] = useState(avatarImageUrl);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("5MB 이하 이미지만 업로드할 수 있어요.");
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file);
      const blob = await (await fetch(compressedDataUrl)).blob();
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const path = `managed/${workspaceId}/${memberId}/${Date.now()}.${ext}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: blob.type });

      if (uploadError) {
        console.error("[ManagedAvatarUploader] storage upload failed:", uploadError);
        setError(`업로드에 실패했어요: ${uploadError.message}`);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setPreview(data.publicUrl);

      startTransition(async () => {
        try {
          await updateManagedMemberAvatar(memberId, data.publicUrl);
        } catch (err) {
          console.error("[ManagedAvatarUploader] updateManagedMemberAvatar failed:", err);
          setError(err instanceof Error ? err.message : "프로필 저장에 실패했어요.");
        }
      });
    } catch {
      setError("이미지 처리에 실패했어요.");
    }
  };

  const handleReset = () => {
    setError("");
    setPreview(null);
    startTransition(async () => {
      try {
        await updateManagedMemberAvatar(memberId, null);
      } catch (err) {
        console.error("[ManagedAvatarUploader] reset failed:", err);
        setError(err instanceof Error ? err.message : "초기화에 실패했어요.");
      }
    });
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar
        name={displayName || "새 구성원"}
        color={avatarColor}
        textColor={MANAGED_AVATAR_TEXT_COLOR}
        imageUrl={preview}
        size={56}
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={isPending}
            className="text-[16px] font-medium text-ocean"
          >
            사진 변경
          </button>
          {preview && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isPending}
              className="text-[16px] text-stone"
            >
              기본 이미지로
            </button>
          )}
        </div>
        {error && <p className="text-[14px] text-terra">{error}</p>}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <div className="flex flex-col">
          <button
            onClick={() => {
              setPickerOpen(false);
              cameraInputRef.current?.click();
            }}
            className="flex items-center gap-3 py-3 text-left text-[17px] text-ink"
          >
            <IconCamera size={18} className="text-honey" />
            카메라로 찍기
          </button>
          <button
            onClick={() => {
              setPickerOpen(false);
              albumInputRef.current?.click();
            }}
            className="flex items-center gap-3 border-t border-border-light py-3 text-left text-[17px] text-ink"
          >
            <IconPhoto size={18} className="text-honey" />
            앨범에서 선택
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
