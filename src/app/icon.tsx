import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
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
          borderRadius: 6,
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="white"
          style={{ width: 18, height: 18 }}
        >
          <path d="M6 6h12l-1.5 9H7.5L6 6z" opacity="0.95" />
          <path d="M8 4h8l0.5 2H7.5l0.5-2z" opacity="0.8" />
          <circle cx="9" cy="18" r="1.2" />
          <circle cx="15" cy="18" r="1.2" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
