import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #1d4ed8, #2563eb, #3b82f6)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -150,
            left: -50,
            width: 350,
            height: 350,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
          }}
        />

        {/* Shopping bag icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="white"
          style={{ width: 80, height: 80, marginBottom: 24, opacity: 0.95 }}
        >
          <path d="M6 6h12l-1.5 9H7.5L6 6z" opacity="0.95" />
          <path d="M8 4h8l0.5 2H7.5l0.5-2z" opacity="0.8" />
          <circle cx="9" cy="18" r="1.2" fill="white" />
          <circle cx="15" cy="18" r="1.2" fill="white" />
          <path d="M10 2v2M14 2v2" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </svg>

        {/* Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "white",
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            maxWidth: 900,
          }}
        >
          Catalogue Marjane
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.85)",
            marginTop: 16,
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Promotions et Offres au Maroc
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "white",
            opacity: 0.3,
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
