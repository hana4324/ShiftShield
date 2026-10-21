import { ImageResponse } from "next/og";

export const alt = "ShiftShield: Coverage when you need it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #07111F 0%, #0B1F3B 60%, #13294B 100%)",
        color: "white",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="96" height="96" viewBox="0 0 120 120">
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
            strokeWidth="10"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 800, letterSpacing: 2 }}>
          <span style={{ color: "#1E63E9" }}>SHIFT</span>
          <span style={{ color: "#9A9FA6" }}>SHIELD</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
          Coverage when you need it.
        </div>
        <div style={{ fontSize: 34, color: "#9A9FA6", lineHeight: 1.3 }}>
          On-demand licensed security officers for Texas. Now enrolling the Dallas-Fort Worth 30-day
          pilot.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 26,
          color: "#9A9FA6",
          letterSpacing: 4,
          fontWeight: 700,
        }}
      >
        <span>VERIFIED. TRUSTED. PROTECTED.</span>
        <span
          style={{
            background: "#1E63E9",
            color: "white",
            padding: "14px 28px",
            borderRadius: 16,
            letterSpacing: 0,
          }}
        >
          Join the pilot
        </span>
      </div>
    </div>,
    { ...size },
  );
}
