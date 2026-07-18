-- fridge: 태블릿 홈 화면 중앙 포토 프레임용 스토리지 버킷 신설
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- is_workspace_member() 헬퍼는 supabase/fix_rls.sql에서 이미 생성되어 있어야 합니다.

-- 경로 규칙: home-photos/{workspace_id}/{filename} — 워크스페이스당 최대 10장 제한은
-- 앱 코드(설정 화면 HomePhotoManager)에서 강제하고, DB 정책은 "그 워크스페이스 멤버인가"만
-- 검사한다. 사진별 메타데이터가 파일명/업로드 시각뿐이라 별도 테이블 없이 버킷 목록을
-- 그대로 쓴다(src/lib/homePhotos.ts).
INSERT INTO storage.buckets (id, name, public)
VALUES ('home-photos', 'home-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "home_photos_public_read" ON storage.objects;
CREATE POLICY "home_photos_public_read" ON storage.objects FOR SELECT
USING (bucket_id = 'home-photos');

DROP POLICY IF EXISTS "home_photos_workspace_write" ON storage.objects;
CREATE POLICY "home_photos_workspace_write" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'home-photos'
  AND is_workspace_member(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "home_photos_workspace_delete" ON storage.objects;
CREATE POLICY "home_photos_workspace_delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'home-photos'
  AND is_workspace_member(((storage.foldername(name))[1])::uuid)
);
