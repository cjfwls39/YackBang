import { ImageResponse } from "next/og";

/** iOS 홈 화면 아이콘 (180×180 PNG) — apple-touch-icon */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#10B981",
          fontFamily: "sans-serif",
          fontSize: "112px",
          fontWeight: 700,
          color: "white",
        }}
      >
        약
      </div>
    ),
    { ...size }
  );
}
