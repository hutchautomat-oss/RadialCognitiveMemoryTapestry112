/**
 * Aerospace EFIS visual tokens for the RCMT HUD.
 *
 * Low-chroma palette, 1px hairlines, mono font, no shadows, no rounded
 * corners over 2px. Cards lean on legibility over decoration — the lattice
 * itself provides the spectacle; the HUD provides the dial.
 */

export const FONT = "'JetBrains Mono', 'Share Tech Mono', 'IBM Plex Mono', 'Courier New', monospace";

export const COLOR = {
  // Deepened background for improved contrast
  bg: "rgba(10,12,16,0.92)",
  bgSolid: "#0a0c10",
  border: "#162027",
  borderStrong: "#24343a",
  text: "#e8ecf1",
  textDim: "#95a0a6",
  textMuted: "#6f7b80",
  nominal: "#5dd89f",
  warn: "#e2a458",
  fail: "#f16b6b",
  accent: "#28d4c9",
  accentDim: "#2d6e68",
  // HUD chip versions of the canonical tier palette (muted for chrome)
  tier: [
    "#2bb8a6", // Fact     — muted cyan-green
    "#37e055", // Scenario — vivid green tuned
    "#f0d54a", // Metric   — yellow
    "#e08b4b", // Theory   — orange
    "#b07bd1", // Dream    — violet
  ] as const,
} as const;

export const cardShell: React.CSSProperties = {
  position: "fixed",
  background: COLOR.bg,
  border: `1px solid ${COLOR.border}`,
  borderRadius: 6,
  fontFamily: FONT,
  color: COLOR.text,
  fontSize: 11,
  zIndex: 100,
  backdropFilter: "blur(4px)",
  letterSpacing: 0.4,
};

export const cardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  borderBottom: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.012)",
  fontSize: 11,
  color: COLOR.textDim,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

export const cardBody: React.CSSProperties = {
  padding: "12px 16px",
};

export const TIER_NAMES = ["FACT", "SCENARIO", "METRIC", "THEORY", "DREAM"] as const;
