---
name: RCMT near-fade auto-declutter vs Foveal Gradient Integrity
description: Why the scaffold near-fade is allowed under the gradient invariant, and the line a future change must not cross.
---

The GhostScaffold VERT shader multiplies scaffold-point alpha by a camera-distance
near-fade (`smoothstep(NEAR_GONE, NEAR_FULL, depth)` on `-mv.z`) so dots right in
front of the camera dissolve, opening a tunnel when you push/fly into the dense core.

**This does NOT violate Foveal Gradient Integrity** — and the distinction is the
load-bearing part to remember:

- The invariant forbids *flattening the per-point foveal size/brightness ramp into
  uniform density*. That ramp (`aSize`, `aAlpha`, radial color) is what encodes the
  Fact→Dream epistemology, and it is left fully intact.
- The near-fade is a **camera-distance** effect, not a remap. At normal viewing
  range every point is well past `NEAR_FULL` (~7 world units), so the gradient renders
  exactly as before; only immediate-foreground occluders fade.

**Why:** a future agent could plausibly do one of two wrong things — (a) delete the
near-fade thinking any alpha change to scaffold is a gradient violation, or (b)
"improve" it into a distance-independent density cap that *does* flatten the ramp.
(a) loses a real usability win for free; (b) silently breaks the optical-compression
thesis. Keep it camera-distance-gated; never let a declutter feature become a
uniform-density remap.

**How to apply:** scaffold-only (live nodes are a separate `SaccadeInstancedMesh`
and must stay untouched). Any new declutter/LOD idea for the lattice must be framed
as "what the camera can currently see," never as "cap density regardless of camera."
