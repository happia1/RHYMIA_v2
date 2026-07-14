import { requireAuthOrRespond } from "@/lib/agentServer";

const NAVER_BLOG_SEARCH_URL = "https://openapi.naver.com/v1/search/blog.json";
const RESULT_COUNT = 15;

/** 네이버가 매칭 키워드를 <b> 태그로 감싸고 &amp; 등을 엔티티로 이스케이프해서 내려준다 —
 * 앱 안에서 순수 텍스트로 보여줘야 하니 태그/엔티티를 걷어낸다. */
function stripNaverMarkup(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

interface NaverBlogItem {
  title: string;
  link: string;
  description: string;
  bloggername: string;
}

/** 끼니 등록 화면 "블로그에서 레시피 찾기" — 네이버 검색 API(블로그) 프록시.
 * NAVER_CLIENT_ID/SECRET은 서버 전용 환경변수라 클라이언트에 노출되지 않고, 여기서만 쓴다.
 * 주의: 네이버 블로그 검색 API 응답에는 썸네일 이미지 필드가 없다(공식 문서 기준) — 결과
 * 목록에서 실제 게시글 썸네일 대신 자리표시 아이콘을 쓰는 이유. */
export async function GET(request: Request) {
  const authError = await requireAuthOrRespond();
  if (authError) return authError;

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ error: "레시피 검색 기능이 아직 설정되지 않았어요." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  if (!query) {
    return Response.json({ error: "검색어를 입력해주세요." }, { status: 400 });
  }

  try {
    const naverRes = await fetch(
      `${NAVER_BLOG_SEARCH_URL}?query=${encodeURIComponent(query)}&display=${RESULT_COUNT}&sort=sim`,
      {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      }
    );

    if (!naverRes.ok) {
      return Response.json({ error: "레시피를 검색하지 못했어요." }, { status: 502 });
    }

    const data = await naverRes.json();
    const items = ((data.items ?? []) as NaverBlogItem[]).map((item) => ({
      title: stripNaverMarkup(item.title),
      summary: stripNaverMarkup(item.description),
      link: item.link,
      blogName: item.bloggername,
    }));

    return Response.json({ items });
  } catch {
    return Response.json({ error: "레시피를 검색하지 못했어요." }, { status: 502 });
  }
}
