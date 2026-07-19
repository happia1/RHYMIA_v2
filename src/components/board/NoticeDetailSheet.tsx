"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FullScreenSheet } from "@/components/ui/FullScreenSheet";
import { NoticeDetailContent } from "@/components/board/NoticeDetailContent";
import type { WorkspaceMemberInfo } from "@/lib/members";
import type { Notice, NoticeComment } from "@/types";

/** 스티커/메모 상세 슬라이드 팝업 — 게시판 탭(BoardSection)과 홈(하고싶은 말 스티커, 고정
 * 메모)이 완전히 동일하게 재사용하는 공용 컴포넌트. 실제 내용(보기/인라인 편집/삭제 확인/
 * 댓글)은 NoticeDetailContent가 담당 — 태블릿 게시판의 메모/공지사항 우측 고정 패널과
 * 공유한다. 이 래퍼는 스티커=부분 높이 BottomSheet, 메모/공지사항=전체화면
 * FullScreenSheet라는 컨테이너 선택만 담당한다. */
export function NoticeDetailSheet({
  notice,
  onClose,
  currentUserId,
  membersById,
  commentsByNotice = {},
}: {
  notice: Notice | null;
  onClose: () => void;
  workspaceId: string;
  currentUserId: string;
  membersById: Record<string, WorkspaceMemberInfo>;
  /** 메모(비스티커) 상세에서만 쓰인다 — 스티커 전용 호출부(홈 "하고싶은 말")는 생략 가능. */
  commentsByNotice?: Record<string, NoticeComment[]>;
}) {
  // 스티커는 부분 높이 BottomSheet, 메모/공지사항은 전체화면 FullScreenSheet(요구사항 9) —
  // notice는 닫힐 때 곧장 null이 되므로, 닫힘 애니메이션이 끝날 때까지 어느 컨테이너였는지
  // 별도로 기억해둔다(그러지 않으면 닫히는 도중 컨테이너 타입 자체가 바뀌어 리마운트되며
  // 트랜지션이 끊긴다).
  const [lastType, setLastType] = useState<Notice["type"] | null>(notice?.type ?? null);
  useEffect(() => {
    if (notice) setLastType(notice.type);
  }, [notice]);

  const Container = lastType === "sticky" ? BottomSheet : FullScreenSheet;

  return (
    <Container open={!!notice} onClose={onClose}>
      {notice && (
        <NoticeDetailContent
          notice={notice}
          onClose={onClose}
          currentUserId={currentUserId}
          membersById={membersById}
          commentsByNotice={commentsByNotice}
        />
      )}
    </Container>
  );
}
