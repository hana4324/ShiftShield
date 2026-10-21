import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#07111F",
      }}
    >
      <svg width="140" height="140" viewBox="0 0 120 120">
        <path
          d="M60 8 L104 24 V58 C104 84 86 104 60 114 C34 104 16 84 16 58 V24 Z"
          fill="#0B1F3B"
          stroke="#1E63E9"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M78 42 C74 34 52 32 46 44 C40 56 60 58 68 62 C80 68 78 84 62 86 C50 88 42 82 40 76"
          fill="none"
          stroke="#1E63E9"
          strokeWidth="11"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { ...size },
  );
}
