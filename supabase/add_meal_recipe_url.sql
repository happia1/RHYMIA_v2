-- fridge: 끼니에 블로그 레시피 링크 저장 지원 — meal.video_id(유튜브)와 공존한다.
-- 본문은 저장하지 않고(저작권) 링크만 보관 — 상세 화면에서 유튜브/블로그 아이콘으로 각각 진입.
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

ALTER TABLE meal ADD COLUMN IF NOT EXISTS recipe_url TEXT;
