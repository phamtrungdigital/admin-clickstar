import { ImageResponse } from "next/og";

// iOS home-screen icon. Mirrors src/app/icon.svg (gradient blue → cyan, white S)
// but rendered to PNG since iOS Safari doesn't honor SVG apple-touch-icons.

export const size = {
  width: 180,
  height: 180,
};

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
          background: "linear-gradient(135deg, #0052CC 0%, #22D3EE 100%)",
          color: "white",
          fontWeight: 900,
          fontSize: 130,
          letterSpacing: "-0.02em",
          // iOS will round the corners itself; keep the canvas square.
        }}
      >
        S
      </div>
    ),
    { ...size },
  );
}
