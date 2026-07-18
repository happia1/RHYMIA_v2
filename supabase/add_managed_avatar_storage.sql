-- fridge: managed 멤버(자녀 등) 프로필 사진 업로드 스토리지 정책
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- avatars 버킷 자체는 supabase/add_notice_comment_and_avatar_storage.sql에서 이미 생성됨.

-- 계정 멤버는 avatars/{user_id}/{filename} 경로에 auth.uid() 기준으로 쓰지만, managed
-- 멤버는 로그인 계정이 없어(auth.uid() 없음) 그 규칙을 쓸 수 없다. 대신
-- avatars/managed/{workspace_id}/{member_id}/{filename} 경로를 쓰고, 업로드 권한은
-- "그 워크스페이스의 멤버인가"로 검사한다(같은 가족이면 서로의 관리 프로필 사진을
-- 등록/수정할 수 있음 — 이 앱의 다른 관리 프로필 편집 권한과 동일한 수준).

DROP POLICY IF EXISTS "avatar_managed_write" ON storage.objects;
CREATE POLICY "avatar_managed_write" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'managed'
  AND is_workspace_member(((storage.foldername(name))[2])::uuid)
);

DROP POLICY IF EXISTS "avatar_managed_update" ON storage.objects;
CREATE POLICY "avatar_managed_update" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'managed'
  AND is_workspace_member(((storage.foldername(name))[2])::uuid)
);
