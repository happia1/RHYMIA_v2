import type { MetadataRoute } from "next";

// Next.js가 이 파일을 자동으로 /manifest.webmanifest로 서빙하고 <link rel="manifest">도
// 알아서 <head>에 넣어준다 — layout.tsx에 수동으로 태그를 추가할 필요 없음. 아이콘은 정식
// 로고가 나오기 전까지의 임시 냉장고 글리프(public/icons, make_icons.js로 생성)이며,
// 정식 로고 교체는 P2.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fridge",
    short_name: "Fridge",
    description: "5초 안에 오늘 우리 집의 상태를 이해할 수 있는 가족 홈 대시보드",
    start_url: "/",
    display: "standalone",
    // 세로/가로 모두 허용 — 태블릿 가로/세로 레이아웃과 폰 가로 모드를 전부 지원하므로
    // 특정 방향으로 잠그지 않는다.
    orientation: "any",
    background_color: "#141417",
    theme_color: "#141417",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
