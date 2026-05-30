/**
 * Aerospace EFIS visual tokens for the RCMT HUD.
 *
 * Low-chroma palette, 1px hairlines, mono font, no shadows, no rounded
 * corners over 2px. Cards lean on legibility over decoration — the lattice
 * itself provides the spectacle; the HUD provides the dial.
 */

export const FONT = "'JetBrains Mono', 'Share Tech Mono', 'IBM Plex Mono', 'Courier New', monospace";

export const COLOR = {
  bg: "rgba(8,10,12,0.88)",
  bgSolid: "#080a0c",
  border: "#2a3338",
  borderStrong: "#3a464d",
  text: "#c6cdd1",
  textDim: "#7a868c",
  textMuted: "#5b6770",
  nominal: "#6dd99e",
  warn: "#e2a458",
  fail: "#d75f5f",
  accent: "#4fd1c5",
  accentDim: "#2d6e68",
  // Tier chips — deliberately MUTED versions of the lattice palette
  // (useSaccadeStore.TIER_RGB). The lattice nodes carry the vivid, opponent
  // tier contrast; the dense HUD chrome stays low-chroma for legibility.
  tier: [
    "#2bb8a6", // Fact     — muted cyan-green
    "#5aa84a", // Scenario — muted green
    "#b8a23a", // Metric   — muted yellow
    "#c2773f", // Theory   — muted orange
    "#9a6fc2", // Dream    — muted violet
  ] as const,
} as const;

export const cardShell: React.CSSProperties = {
  position: "fixed",
  background: COLOR.bg,
  border: `1px solid ${COLOR.border}`,
  borderRadius: 2,
  fontFamily: FONT,
  color: COLOR.text,
  fontSize: 10.5,
  zIndex: 100,
  backdropFilter: "blur(3px)",
  letterSpacing: 0.3,
};

export const cardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "5px 9px",
  borderBottom: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.015)",
  fontSize: 9.5,
  color: COLOR.textDim,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

export const cardBody: React.CSSProperties = {
  padding: "8px 9px",
};

export const TIER_NAMES = ["FACT", "SCENARIO", "METRIC", "THEORY", "DREAM"] as const;
