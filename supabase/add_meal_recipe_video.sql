-- 끼니(meal)에 유튜브 레시피 영상 참조 컬럼 추가.
-- 썸네일은 저작권상 스토리지에 복제하지 않고 유튜브 썸네일 URL을 그때그때 참조만 한다
-- (https://img.youtube.com/vi/{video_id}/hqdefault.jpg) — video_id만 저장하면 충분.
-- 재실행 안전.

ALTER TABLE meal ADD COLUMN IF NOT EXISTS video_id TEXT;
ALTER TABLE meal ADD COLUMN IF NOT EXISTS recipe_title TEXT;
