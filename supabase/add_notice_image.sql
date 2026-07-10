-- fridge: "하고싶은 말"(구 스티커)에 이미지 첨부 지원 + 전용 Storage 버킷 추가
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- 메모/공지 작성 시 첨부하는 이미지는 Gemini 텍스트 추출용으로만 쓰고 저장하지 않으므로
-- 이 마이그레이션과 무관합니다(에이전트 서버로 base64 전송 후 버려짐).

ALTER TABLE notice ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 경로 규칙: notice-images/{user_id}/{filename}. 읽기는 공개(다른 이미지 URL 필드와 동일),
-- 쓰기는 본인 폴더만 허용 (avatars 버킷과 동일한 패턴).
INSERT INTO storage.buckets (id, name, public)
VALUES ('notice-images', 'notice-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "notice_image_public_read" ON storage.objects;
CREATE POLICY "notice_image_public_read" ON storage.objects FOR SELECT
USING (bucket_id = 'notice-images');

DROP POLICY IF EXISTS "notice_image_own_write" ON storage.objects;
CREATE POLICY "notice_image_own_write" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'notice-images' AND auth.uid()::text = (storage.foldername(name))[1]);
