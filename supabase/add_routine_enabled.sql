-- fridge: 일정 탭 상단 "내 루틴" 위젯 — 멤버별 루틴 사용 여부 토글
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- 기존 member_update RLS 정책(add_managed_members.sql)이 이미 본인/관리 멤버 UPDATE를
-- 허용하므로 이 마이그레이션은 컬럼 추가만 하면 됩니다 (RLS 변경 불필요).

ALTER TABLE workspace_member ADD COLUMN IF NOT EXISTS routine_enabled BOOLEAN DEFAULT true;
