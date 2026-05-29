import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // 식약처 의약품 이미지 (박스·낱알)
        protocol: "https",
        hostname: "nedrug.mfds.go.kr",
        pathname: "/**",
      },
    ],
  },

  // ── 보안 헤더 ────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // MIME 스니핑 차단 (브라우저가 Content-Type 임의 해석 금지)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 클릭재킹 차단 (iframe 삽입 금지)
          { key: "X-Frame-Options", value: "DENY" },
          // 외부 링크 클릭 시 URL 정보 최소화
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 브라우저 기능 제한 (카메라·마이크·위치 등 미사용 기능 차단)
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // XSS 이중 방어: 신뢰된 출처의 스크립트·스타일·이미지만 허용
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js 개발 모드 호환
              "style-src 'self' 'unsafe-inline'",                // Tailwind inline 스타일 허용
              "img-src 'self' data: https://nedrug.mfds.go.kr", // 식약처 이미지만 외부 허용
              "connect-src 'self'",
              "font-src 'self'",
              "frame-ancestors 'none'",                          // X-Frame-Options 보완
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
