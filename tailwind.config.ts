import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    // src/lib(homeTheme.ts의 mirror.* 등 클래스 문자열이 정의된 곳)도 스캔 대상에
    // 포함해야 한다 — 여기가 빠져 있으면 mirror.* 클래스 전체가 실제로는
    // 생성되지 않아, 겉으로는 코드가 맞는데도 스타일이 하나도 안 먹는 것처럼 보인다.
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // 다크 모드 대응: CSS 변수를 참조하므로 앱 전체(식탁/일정/게시판/설정 포함)에서
        // 자동으로 테마가 반영된다 (src/app/globals.css 참고).
        cream: "var(--bg-page)",
        surface: "var(--bg-surface)",
        ink: "var(--text-primary)",
        stone: "var(--text-secondary)",
        "border-light": "var(--hairline)",
        "btn-surface": "var(--btn-surface-bg)",
        "btn-surface-text": "var(--btn-surface-text)",
        input: "var(--input-bg)",
        "input-text": "var(--input-text)",
        "input-placeholder": "var(--input-placeholder)",
        "input-border": "var(--input-border)",
        honey: "#E8A04A",
        ocean: "#3D7EAA",
        sage: "#5BAD7F",
        terra: "#D96B5A",
        lavender: "#9B8EC4",
        rose: "#E8416A",
      },
      gridTemplateColumns: {
        board: "3fr 2fr",
        mirror: "1fr 1.4fr 1fr",
      },
      fontFamily: {
        // "하고싶은 말"(스티키노트) 전용 손글씨 폰트 — src/app/layout.tsx에서 로드
        handwriting: ["var(--font-handwriting)"],
      },
      spacing: {
        section: "30px",
        "label-gap": "12px",
        row: "7px",
        "section-indent": "var(--section-indent)",
      },
    },
  },
  plugins: [],
};
export default config;
