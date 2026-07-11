-- fridge: 끼니 등록/수정 시 이미지 삽입 지원용 Storage 버킷
-- meal.image_url 컬럼은 스키마에 이미 존재하지만(초기 설계 포함) 전용 버킷이 없어서 추가한다.
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-images', 'meal-images', true)
ON CONFLICT (id) DO NOTHING;

-- 경로 규칙: meal-images/{user_id}/{filename}. 읽기는 공개(다른 이미지 URL 필드와 동일),
-- 쓰기/삭제는 본인 폴더만 허용 (avatars/notice-images/receipts 버킷과 동일한 패턴).
DROP POLICY IF EXISTS "meal_image_public_read" ON storage.objects;
CREATE POLICY "meal_image_public_read" ON storage.objects FOR SELECT
USING (bucket_id = 'meal-images');

DROP POLICY IF EXISTS "meal_image_own_write" ON storage.objects;
CREATE POLICY "meal_image_own_write" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'meal-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "meal_image_own_delete" ON storage.objects;
CREATE POLICY "meal_image_own_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'meal-images' AND auth.uid()::text = (storage.foldername(name))[1]);
