-- fridge: 공지/메모 댓글 + 프로필 이미지 업로드용 Storage 버킷 추가
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image_url TEXT;

CREATE TABLE IF NOT EXISTS notice_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID REFERENCES notice(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notice_comment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access" ON notice_comment;
CREATE POLICY "workspace_access" ON notice_comment FOR ALL
USING (
  EXISTS (SELECT 1 FROM notice WHERE notice.id = notice_id AND is_workspace_member(notice.workspace_id))
);

-- 프로필 이미지 업로드용 퍼블릭 버킷. 경로 규칙: avatars/{user_id}/{filename}
-- 읽기는 공개(다른 이미지 URL 필드들과 동일한 수준), 쓰기는 본인 폴더만 허용.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatar_public_read" ON storage.objects;
CREATE POLICY "avatar_public_read" ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatar_own_write" ON storage.objects;
CREATE POLICY "avatar_own_write" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatar_own_update" ON storage.objects;
CREATE POLICY "avatar_own_update" ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
