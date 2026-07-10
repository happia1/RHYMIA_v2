-- fridge: 장바구니 "장보기 완료" 플로우 — 구매 항목을 expense 기록 하나로 묶기 위한 연결 컬럼
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- 이미 구매 처리된(is_purchased=true) 항목 중 expense_id가 NULL인 것들이
-- "아직 장보기 완료로 묶이지 않은, 오늘 체크한 항목"으로 취급됩니다.

ALTER TABLE shopping_item ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES expense(id) ON DELETE SET NULL;

-- 영수증 사진은 개별 shopping_item이 아니라 "장보기 완료"로 묶인 expense(그 날의 장보기 전체) 단위로 붙는다.
-- OCR 파싱은 P2 범위 밖 — 지금은 업로드+URL 저장까지만.
ALTER TABLE expense ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;

-- 경로 규칙: receipts/{user_id}/{filename}. 읽기는 공개(다른 이미지 URL 필드와 동일),
-- 쓰기는 본인 폴더만 허용 (avatars/notice-images 버킷과 동일한 패턴).
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "receipt_public_read" ON storage.objects;
CREATE POLICY "receipt_public_read" ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "receipt_own_write" ON storage.objects;
CREATE POLICY "receipt_own_write" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
