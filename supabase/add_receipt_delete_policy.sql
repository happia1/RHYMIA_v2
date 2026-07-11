-- fridge: 코드리뷰 반영 — receipts/avatars/notice-images 세 버킷 모두 읽기(SELECT)/쓰기(INSERT)
-- 정책만 있고 DELETE 정책이 빠져 있었음. 본인 폴더(storage.foldername(name)[1] = auth.uid())
-- 한정으로 삭제를 허용한다. Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

DROP POLICY IF EXISTS "receipt_own_delete" ON storage.objects;
CREATE POLICY "receipt_own_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatar_own_delete" ON storage.objects;
CREATE POLICY "avatar_own_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "notice_image_own_delete" ON storage.objects;
CREATE POLICY "notice_image_own_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'notice-images' AND auth.uid()::text = (storage.foldername(name))[1]);
