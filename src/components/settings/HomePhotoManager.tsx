"use client";

import { useRef, useState } from "react";
import { IconCamera, IconPhoto, IconX } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { ImageCropSheet, type CropRatioOption } from "@/components/ui/ImageCropSheet";
import { MAX_HOME_PHOTOS, type HomePhoto } from "@/lib/homePhotos";

const BUCKET = "home-photos";

const HOME_PHOTO_RATIOS: CropRatioOption[] = [
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
];

/** 태블릿 홈 중앙 포토 프레임에 쓸 사진 관리 — 별도 DB 테이블 없이 Storage 버킷에 직접
 * 업로드/삭제한다(목록은 listHomePhotos가 버킷을 그대로 나열). 카메라/앨범 선택 후
 * ImageCropSheet(자유 비율 — 1:1/4:3/16:9 중 선택)에서 잘라낸 결과를 그대로 올린다.
 * 크롭 캔버스 출력 자체가 리사이즈+재인코딩이라 별도 compressImage 호출은 필요 없다. */
export function HomePhotoManager({
  workspaceId,
  initialPhotos,
}: {
  workspaceId: string;
  initialPhotos: HomePhoto[];
}) {
  const { showToast } = useToast();
  const [photos, setPhotos] = useState(initialPhotos);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (photos.length >= MAX_HOME_PHOTOS) {
      showToast(`최대 ${MAX_HOME_PHOTOS}장까지 등록할 수 있어요.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      showToast("이미지 파일만 업로드할 수 있어요.");
      return;
    }

    setCropFile(file);
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropFile(null);
    setIsUploading(true);
    try {
      const name = `${Date.now()}.jpg`;
      const path = `${workspaceId}/${name}`;

      const supabase = createClient();
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/jpeg" });

      if (error) {
        console.error("[HomePhotoManager] upload failed:", error);
        showToast("사진 업로드에 실패했어요.");
        return;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setPhotos((prev) => [{ name, url: data.publicUrl }, ...prev]);
    } catch (err) {
      console.error("[HomePhotoManager] processing failed:", err);
      showToast("이미지 처리에 실패했어요.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (photo: HomePhoto) => {
    const supabase = createClient();
    const { error } = await supabase.storage.from(BUCKET).remove([`${workspaceId}/${photo.name}`]);

    if (error) {
      console.error("[HomePhotoManager] delete failed:", error);
      showToast("삭제에 실패했어요.");
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.name !== photo.name));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-stone">
        태블릿 홈 화면 중앙에 무작위 순서로 돌아가며 나와요 ({photos.length}/{MAX_HOME_PHOTOS})
      </p>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((photo) => (
          <div key={photo.name} className="relative aspect-square overflow-hidden rounded-xl bg-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => handleDelete(photo)}
              aria-label="사진 삭제"
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white"
            >
              <IconX size={12} />
            </button>
          </div>
        ))}
        {photos.length < MAX_HOME_PHOTOS && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={isUploading}
            className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border-light text-[var(--text-muted)] disabled:opacity-50"
          >
            +
          </button>
        )}
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

      <ImageCropSheet
        open={!!cropFile}
        file={cropFile}
        shape="rect"
        ratioOptions={HOME_PHOTO_RATIOS}
        onCancel={() => setCropFile(null)}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
