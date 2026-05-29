import type { MetadataRoute } from "next";

/**
 * PWA 웹 앱 매니페스트
 * /manifest.webmanifest 로 서빙됨 (Next.js App Router 자동 처리)
 *
 * 아이콘 전략:
 *  - SVG (sizes: "any") → Chrome/Android 홈 화면 추가
 *  - apple-icon (180×180 PNG) → iOS Safari는 <link rel="apple-touch-icon">으로 별도 처리
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "약방 — 의약품 병용금기 확인기",
    short_name: "약방",
    description:
      "복용 중인 약이 함께 먹어도 되는지 쉽게 확인하세요. 전문 용어 없이 알기 쉽게 알려드립니다.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#10B981",
    lang: "ko",
    orientation: "portrait",
    icons: [
      {
        // SVG — 모든 해상도에서 선명하게 표시 (Chrome/Android)
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
