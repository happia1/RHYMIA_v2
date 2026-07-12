const ALLOWED_YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

/** 유튜브 도메인인지 확인하고 videoId를 뽑아낸다 — watch?v=, youtu.be/, /shorts/ 형태를 지원.
 * 서버 라우트(/api/youtube/oembed)가 임의 URL을 그대로 외부에 프록시하지 않도록 여기서 먼저 검증한다. */
export function extractYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!ALLOWED_YOUTUBE_HOSTS.has(url.hostname)) return null;

  if (url.hostname === "youtu.be") {
    return url.pathname.slice(1) || null;
  }
  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }
  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.split("/")[2] ?? null;
  }
  return null;
}

/** 유튜브 썸네일은 저작권상 스토리지에 복제하지 않고 이 URL 패턴으로 그때그때 참조만 한다.
 * 영상이 삭제되는 등으로 로드에 실패하면 호출부가 <img onError>로 기본 아이콘 폴백을 보여준다. */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export interface YoutubeOembedResult {
  videoId: string;
  title: string;
}

/** 붙여넣은 유튜브 링크에서 제목/videoId를 가져온다 — 실제 조회는 서버 라우트
 * (/api/youtube/oembed)를 경유(로그인 검증 + 유튜브 도메인 검증). */
export async function fetchYoutubeOembed(
  url: string
): Promise<YoutubeOembedResult | { error: string }> {
  try {
    const res = await fetch("/api/youtube/oembed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "영상 정보를 불러오지 못했어요." };
    return { videoId: data.videoId, title: data.title };
  } catch {
    return { error: "영상 정보를 불러오지 못했어요." };
  }
}
