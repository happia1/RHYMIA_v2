import { requireAuthOrRespond } from "@/lib/agentServer";
import { extractYoutubeVideoId } from "@/lib/youtube";

/** 붙여넣은 유튜브 링크의 제목을 가져오는 프록시 — 공개 oEmbed 엔드포인트라 API 키는
 * 필요 없지만, 로그인한 워크스페이스 구성원만 쓰도록 서버에서 한 번 더 검증하고
 * 유튜브 도메인이 아닌 임의 URL을 그대로 넘기지 않도록 막는다. */
export async function POST(request: Request) {
  const authError = await requireAuthOrRespond();
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : null;
  if (!url) {
    return Response.json({ error: "URL을 입력해주세요." }, { status: 400 });
  }

  const videoId = extractYoutubeVideoId(url);
  if (!videoId) {
    return Response.json({ error: "유튜브 링크가 아니에요." }, { status: 400 });
  }

  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!oembedRes.ok) {
      return Response.json({ error: "영상 정보를 찾을 수 없어요." }, { status: 404 });
    }
    const data = await oembedRes.json();
    return Response.json({ videoId, title: (data.title as string) ?? "레시피 영상" });
  } catch {
    return Response.json({ error: "영상 정보를 불러오지 못했어요." }, { status: 502 });
  }
}
