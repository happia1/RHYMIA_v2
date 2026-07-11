-- fridge: expense 출처 구분(온라인/오프라인) 컬럼 추가
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

ALTER TABLE expense ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'offline';
