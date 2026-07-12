-- 공지(notice) 타입 폐지 → 메모(memo)로 통합.
-- 기존 공지 행은 삭제하지 않고 메모 타입 + 고정(pinned) 상태로 전환한다.
-- 재실행 안전: is_pinned 컬럼은 존재 보장만(이미 있으면 그대로), UPDATE는
-- WHERE type = 'notice' 조건이라 한 번 전환되면 다시 실행해도 대상이 없어 아무 일도 안 함.

ALTER TABLE notice ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

UPDATE notice
SET type = 'memo', is_pinned = true
WHERE type = 'notice';
