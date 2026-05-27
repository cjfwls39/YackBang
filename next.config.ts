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
};

export default nextConfig;
