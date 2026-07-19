/** 태블릿 홈 화면 중앙 포토 프레임에 쓰는 사진 정보 — 클라이언트/서버 양쪽에서 안전하게
 * import 가능(타입·상수만 있음). 실제 목록 조회(Storage 접근)는 서버 전용인
 * `@/lib/homePhotos.server`에 있다 — 같은 파일에 두면 그 파일의 `next/headers` 의존이
 * 클라이언트 컴포넌트(HomePhotoManager)까지 번들링돼 빌드가 깨진다. */
export const MAX_HOME_PHOTOS = 10;

export interface HomePhoto {
  /** 삭제 시 필요한 원본 파일명(경로는 `{workspaceId}/{name}`으로 다시 조립) */
  name: string;
  url: string;
}
