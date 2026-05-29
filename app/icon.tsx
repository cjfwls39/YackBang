import { ImageResponse } from "next/og";

/** 브라우저 탭 파비콘 (32×32 PNG) */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "7px",
          fontFamily: "sans-serif",
          fontSize: "20px",
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
