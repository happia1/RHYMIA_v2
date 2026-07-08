"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateAvatarImage, clearAvatarImage } from "@/app/(main)/settings/actions";
import { Avatar } from "@/components/ui/Avatar";
import { AVATAR_SIZE } from "@/lib/uiTokens";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function AvatarUploader({
  userId,
  displayName,
  avatarColor,
  avatarTextColor,
  avatarImageUrl,
}: {
  userId: string;
  displayName: string;
  avatarColor: string;
  avatarTextColor: string;
  avatarImageUrl: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(avatarImageUrl);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

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

    const supabase = createClient();
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error("[AvatarUploader] storage upload failed:", uploadError);
      setError(`업로드에 실패했어요: ${uploadError.message}`);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setPreview(data.publicUrl);

    startTransition(async () => {
      try {
        await updateAvatarImage(data.publicUrl);
      } catch (e) {
        console.error("[AvatarUploader] updateAvatarImage failed:", e);
        setError(e instanceof Error ? e.message : "프로필 저장에 실패했어요.");
      }
    });
  };

  const handleReset = () => {
    setError("");
    setPreview(null);
    startTransition(async () => {
      try {
        await clearAvatarImage();
      } catch (e) {
        console.error("[AvatarUploader] clearAvatarImage failed:", e);
        setError(e instanceof Error ? e.message : "초기화에 실패했어요.");
      }
    });
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar
        name={displayName}
        color={avatarColor}
        textColor={avatarTextColor}
        imageUrl={preview}
        size={AVATAR_SIZE.header * 1.5}
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="text-[13px] font-medium text-ocean"
          >
            사진 변경
          </button>
          {preview && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isPending}
              className="text-[13px] text-stone"
            >
              기본 이미지로
            </button>
          )}
        </div>
        {error && <p className="text-[12px] text-terra">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
