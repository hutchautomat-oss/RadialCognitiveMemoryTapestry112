/**
 * HUD ONBOARDING — a dismissable five-panel walkthrough shown over the live
 * lattice. It opens automatically on first load (no `rcmt:hud:mode:v1` key)
 * and can be re-opened any time via the `/tour` console command.
 *
 * Dismiss semantics set the user's mode preference:
 *   - "Done" (finished the tour)  → GUIDED
 *   - "Skip" on a true first run  → AEROSPACE
 *   - "Skip" when a preference already exists → leave mode unchanged
 *
 * This component is pure chrome: it reads/sets HUD mode + onboarding state but
 * never touches telemetry, the ticker, or the injection pipeline.
 */

import { useState } from "react";
import {
  useHudStore,
  hudModePreferenceExists,
} from "../store/useHudStore";
import { COLOR, FONT, TIER_NAMES } from "./hud/tokens";

interface Panel {
  kicker: string;
  title: string;
  body: string;
  visual?: "tiers";
}

const PANELS: Panel[] = [
  {
    kicker: "01 · THE EMPTY LATTICE",
    title: "A fixed 8,000-slot tapestry",
    body:
      "The dim cloud you see is the ghost scaffold — every one of the 8,000 memory slots, drawn at rest before anything is stored. Capacity is constant forever: the substrate is always 224 KB on the wire whether it holds one memory or eight thousand.",
  },
  {
    kicker: "02 · AXIOM SEED",
    title: "Seven irreducible truths first",
    body:
      "Moments after boot, seven Fact-tier axioms drop into the dense core — the lattice's bedrock. Facts cluster tightly at the center because they carry the highest confidence; that density is the meaning, not decoration.",
  },
  {
    kicker: "03 · THOUGHTS DRIP IN",
    title: "The lattice thinks out loud",
    body:
      "An autonomous ticker then injects phrases every few seconds. Each one is classified on-device into a tier and placed by meaning — you'll watch new spheres starburst into the shell. Type your own phrase in the Command Console to inject a memory yourself.",
  },
  {
    kicker: "04 · FIVE TIERS, CORE TO RIM",
    title: "From Fact to Dream",
    body:
      "Every memory belongs to one of five tiers, distinguished by color and by how far from the core it sits. Rock-solid Facts hug the center; speculative Dreams disperse to the sparse rim. The gradient encodes the scientific method into the geometry.",
    visual: "tiers",
  },
  {
    kicker: "05 · FORMAT TRIPWIRES",
    title: "Drift is visible, never silent",
    body:
      "The five dots at the top center are always-on checks that the wire format and geometry haven't drifted. All green means the substrate is still byte-stable; any red dot means a contract just broke. That guarantee is why the binary can be picked up mid-thought by any model.",
  },
];

export function HudOnboarding() {
  const open = useHudStore((s) => s.onboardingOpen);
  const setOnboardingOpen = useHudStore((s) => s.setOnboardingOpen);
  const setHudMode = useHudStore((s) => s.setHudMode);
  const [index, setIndex] = useState(0);

  if (!open) return null;

  const panel = PANELS[index];
  const isLast = index === PANELS.length - 1;

  function close(mode?: "guided" | "aerospace") {
    if (mode) {
      setHudMode(mode);
    } else if (!hudModePreferenceExists()) {
      // True first run, user skipped → default to aerospace and remember it.
      setHudMode("aerospace");
    }
    setOnboardingOpen(false);
    setIndex(0);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(4,6,8,0.74)",
        backdropFilter: "blur(2px)",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: "min(520px, calc(100vw - 48px))",
          background: COLOR.bgSolid,
          border: `1px solid ${COLOR.borderStrong}`,
          borderRadius: 3,
          boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "9px 14px",
            borderBottom: `1px solid ${COLOR.border}`,
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <span
            style={{
              color: COLOR.accent,
              fontSize: 10,
              letterSpacing: 1.4,
            }}
          >
            RCMT · GUIDED TOUR
          </span>
          <button
            type="button"
            onClick={() => close()}
            aria-label="Skip tour"
            style={{
              background: "transparent",
              border: "none",
              color: COLOR.textDim,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 10,
              letterSpacing: 0.8,
            }}
          >
            SKIP ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 22px 6px" }}>
          <div
            style={{
              color: COLOR.textMuted,
              fontSize: 9.5,
              letterSpacing: 1.6,
              marginBottom: 8,
            }}
          >
            {panel.kicker}
          </div>
          <div
            style={{
              color: COLOR.text,
              fontSize: 17,
              letterSpacing: 0.3,
              marginBottom: 12,
            }}
          >
            {panel.title}
          </div>
          <div
            style={{
              color: COLOR.textDim,
              fontSize: 11.5,
              lineHeight: 1.65,
              letterSpacing: 0.2,
            }}
          >
            {panel.body}
          </div>

          {panel.visual === "tiers" ? (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 16,
                marginBottom: 4,
              }}
            >
              {TIER_NAMES.map((name, i) => (
                <div
                  key={name}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: "100%",
                      height: 5,
                      background: COLOR.tier[i],
                      opacity: 0.85,
                    }}
                  />
                  <span
                    style={{
                      color: COLOR.textDim,
                      fontSize: 8.5,
                      letterSpacing: 0.6,
                    }}
                  >
                    {name}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer: dots + nav */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px 14px",
            marginTop: 8,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {PANELS.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: i === index ? COLOR.accent : COLOR.border,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {index > 0 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                style={navButton(false)}
              >
                BACK
              </button>
            ) : null}
            {isLast ? (
              <button
                type="button"
                onClick={() => close("guided")}
                style={navButton(true)}
              >
                DONE
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(PANELS.length - 1, i + 1))}
                style={navButton(true)}
              >
                NEXT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function navButton(primary: boolean): React.CSSProperties {
  return {
    background: primary ? COLOR.accent : "transparent",
    border: `1px solid ${primary ? COLOR.accent : COLOR.border}`,
    borderRadius: 2,
    color: primary ? COLOR.bgSolid : COLOR.textDim,
    cursor: "pointer",
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 1,
    padding: "5px 16px",
  };
}
