import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Noto Sans KR — 한글 본문 폰트
 * Google Fonts Unicode-range 분할 덕분에 한글 청크만 필요 시 로드됨
 */
const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

/* ── PWA 뷰포트 설정 (Next.js App Router: viewport는 metadata와 별도 export) ── */
export const viewport: Viewport = {
  themeColor: "#10B981",
  width: "device-width",
  initialScale: 1,
  // 확대 허용 — 접근성 지침상 maximumScale=1 강제 금지
};

/* ── 앱 메타데이터 ── */
export const metadata: Metadata = {
  title: "약방 — 의약품 병용금기 확인기",
  description:
    "복용 중인 약이 함께 먹어도 되는지 쉽게 확인하세요. 전문 용어 없이 알기 쉽게 알려드립니다.",

  // PWA — manifest 연결
  manifest: "/manifest.webmanifest",

  // iOS Safari "홈 화면에 추가" 지원
  appleWebApp: {
    capable: true,
    title: "약방",
    statusBarStyle: "default",
  },

  // 기본 Open Graph (링크 공유 미리보기)
  openGraph: {
    title: "약방 — 의약품 병용금기 확인기",
    description: "복용 중인 약이 함께 먹어도 되는지 쉽게 확인하세요.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${notoSansKR.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
