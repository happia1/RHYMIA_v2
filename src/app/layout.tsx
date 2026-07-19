import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Nanum_Pen_Script } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
// "하고싶은 말"(스티키노트) 전용 손글씨 폰트 — 나눔손글씨 계열, 다른 곳에는 적용하지 않음
// adjustFontFallback: Next가 이 폰트의 폴백 메트릭(레이아웃 시프트 보정용)을 자체 DB에서
// 못 찾아서 매 컴파일마다 "Failed to find font override values" 경고를 찍는다 — try/catch로
// 감싸져 있어 빌드/렌더링에는 영향 없는 콘솔 경고일 뿐이지만(폰트 자체는 정상 로드/적용됨),
// 굳이 못 찾을 자동 보정을 계속 시도하지 않도록 꺼서 경고 자체를 없앤다.
const handwriting = Nanum_Pen_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-handwriting",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "fridge",
  description: "5초 안에 오늘 우리 집의 상태를 이해할 수 있는 가족 홈 대시보드",
  // manifest.ts는 Next.js가 자동으로 <link rel="manifest">를 넣어주지만, iOS Safari는
  // 매니페스트의 icons를 홈 화면 아이콘으로 안 쓰고 apple-touch-icon만 본다 — 그래서
  // 별도로 지정. appleWebApp이 "홈 화면에 추가"로 실행됐을 때 상단 상태바를 앱 콘텐츠
  // 위로 반투명하게 겹치는 black-translucent 스타일을 적용한다.
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fridge",
  },
};

// viewportFit: "cover" — 이게 없으면 iOS Safari에서 env(safe-area-inset-*)가 전부 0으로
// 취급돼(globals.css의 --dock-h 계산 포함) 노치/홈 인디케이터 영역을 반영할 수 없다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('fridge-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}",
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${handwriting.variable} antialiased`}
      >
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
