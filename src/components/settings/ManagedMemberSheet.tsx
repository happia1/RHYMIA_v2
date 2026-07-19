"use client";

import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { ManagedAvatarUploader } from "@/components/settings/ManagedAvatarUploader";
import {
  createManagedMember,
  updateManagedMember,
  deleteManagedMember,
} from "@/app/(main)/settings/actions";

const AVATAR_COLOR_OPTIONS = ["#E1F5EE", "#FDE8D0", "#E3E8FF", "#FFE0E0", "#F3E1FF", "#E8F5D0"];

export interface ManagedMemberEditTarget {
  id: string;
  display_name: string;
  avatar_color: string;
  avatar_image_url: string | null;
  birth_year: number | null;
}

export function ManagedMemberSheet({
  open,
  onClose,
  workspaceId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  /** 지정하면 수정 모드, 없으면 새 구성원 추가 모드 */
  existing?: ManagedMemberEditTarget | null;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState(existing?.display_name ?? "");
  const [color, setColor] = useState(existing?.avatar_color ?? AVATAR_COLOR_OPTIONS[0]);
  const [birthYear, setBirthYear] = useState(existing?.birth_year?.toString() ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName(existing?.display_name ?? "");
    setColor(existing?.avatar_color ?? AVATAR_COLOR_OPTIONS[0]);
    setBirthYear(existing?.birth_year?.toString() ?? "");
    setConfirmingDelete(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      avatarColor: color,
      birthYear: birthYear ? Number(birthYear) : null,
    };

    startTransition(async () => {
      try {
        if (existing) {
          await updateManagedMember(existing.id, input);
          showToast("프로필이 수정되었습니다.");
        } else {
          const result = await createManagedMember(workspaceId, input);
          if (!result.ok) {
            showToast(result.message);
            return;
          }
          showToast("구성원이 추가되었습니다.");
        }
        handleClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "저장에 실패했어요.");
      }
    });
  };

  const handleDelete = () => {
    if (!existing) return;
    startTransition(async () => {
      try {
        await deleteManagedMember(existing.id);
        showToast("프로필이 삭제되었습니다.");
        handleClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "삭제에 실패했어요.");
      }
    });
  };

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-[20px] font-medium text-ink">
          {existing ? "프로필 수정" : "구성원 추가"}
        </h2>

        {existing ? (
          <ManagedAvatarUploader
            workspaceId={workspaceId}
            memberId={existing.id}
            displayName={name}
            avatarColor={color}
            avatarImageUrl={existing.avatar_image_url}
          />
        ) : (
          <Avatar name={name || "새 구성원"} color={color} textColor="#1A1A18" size={56} />
        )}

        <div className="flex flex-wrap gap-2">
          {AVATAR_COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={c}
              className={`h-8 w-8 rounded-full ${
                color === c ? "ring-2 ring-ink ring-offset-2" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 (예: 첫째)"
          className="h-11 rounded-xl px-3 text-[17px]"
        />
        <Input
          type="number"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          placeholder="출생연도 (선택)"
          className="h-11 rounded-xl px-3 text-[17px]"
        />

        <button
          onClick={handleSubmit}
          disabled={isPending || !name.trim()}
          className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[18px] font-medium text-cream disabled:opacity-50"
        >
          {existing ? "수정하기" : "추가하기"}
        </button>

        {existing && (
          <>
            {confirmingDelete ? (
              <div className="flex flex-col gap-2 rounded-xl border border-terra/30 p-3">
                <p className="text-[16px] text-ink">
                  이 프로필을 삭제하면 등록된 루틴도 함께 삭제돼요. 이 프로필을 대상으로
                  지정했던 일정은 그대로 남지만, 더 이상 특정 대상으로 표시되지 않아요.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 rounded-xl bg-cream py-2 text-[16px] font-medium text-stone"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className="flex-1 rounded-xl bg-terra py-2 text-[16px] font-medium text-white disabled:opacity-50"
                  >
                    삭제하기
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-[16px] font-medium text-terra"
              >
                프로필 삭제
              </button>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
