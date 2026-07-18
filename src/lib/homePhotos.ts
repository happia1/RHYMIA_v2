import { createClient } from "@/lib/supabase/server";

const BUCKET = "home-photos";
/** 워크스페이스당 최대 등록 가능 장수 — 설정 화면(HomePhotoManager)에서 이 값으로 업로드를 막는다. */
export const MAX_HOME_PHOTOS = 10;

export interface HomePhoto {
  /** 삭제 시 필요한 원본 파일명(경로는 `{workspaceId}/{name}`으로 다시 조립) */
  name: string;
  url: string;
}

/** 태블릿 홈 화면 중앙 포토 프레임(및 설정 탭 관리 UI)에 쓸 사진 목록 — 별도 DB 테이블 없이
 * Storage 버킷의 `{workspaceId}/` 폴더를 그대로 나열한다(사진마다 필요한 메타데이터가
 * 파일명/업로드 시각뿐이라 테이블을 따로 둘 이유가 없음). 실패하면 빈 배열로 폴백해
 * 사진이 없는 것과 동일하게(순수 블랙 여백) 처리되게 한다. */
export async function listHomePhotos(workspaceId: string): Promise<HomePhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).list(workspaceId, {
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error || !data) return [];

  return data
    .filter((f) => f.name !== ".emptyFolderPlaceholder")
    .map((f) => {
      const path = `${workspaceId}/${f.name}`;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return { name: f.name, url: pub.publicUrl };
    });
}
