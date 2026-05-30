---
name: Promotion comets vs ghost scaffold
description: Why promotion-migration comets must be amber + additive, not tier-colored, to survive the teal GhostScaffold.
---

# Promotion comets are amber + additive by design

The promotion/migration comet trails (PromotionTraces) must render in a single hot
**amber**, drawn with **AdditiveBlending**, NOT in per-tier colors with normal
blending.

**Why:** The GhostScaffold paints a cool-teal point field whose density/brightness
peaks at the core — exactly along the inward path a promotion comet travels. A
tier-hued (often teal-family) trail under NormalBlending blends into that field and
visually disappears, even though the component is mounted and firing correctly (no
JS error). Both replit.md and the empty-lattice task call them "amber comets" — the
tier-colored variant was a drift from that intent that only became invisible once
the scaffold got brighter. Amber + additive guarantees the head glows OVER the
scaffold regardless of where it travels.

**How to apply:** If comets "disappear" after a GhostScaffold brightness/color
change, do NOT dim the scaffold (its look is approved) — keep comets amber and
additive. Any new render-side glow that overlaps the core path must contrast the
teal scaffold (warm hue + additive), not match it.

**Cross-component coupling worth remembering:** GhostScaffold (backdrop) and
PromotionTraces (foreground glow) are separate components reading separate data, so
a scaffold change can silently break comet *legibility* with no error and no test
failure — only by-eye verification on real hardware catches it (the sandbox has no
WebGL: "BindToCurrentSequence failed").
