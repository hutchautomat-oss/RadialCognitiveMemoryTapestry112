/**
 * slotOps — the console's lawful, manual operation surface for a single cell.
 *
 * The per-intersection console (SelectedMemory) never writes the lattice
 * directly. It calls these wrappers, which:
 *   1. delegate the VRAM mutation to a useSaccadeStore action (the single
 *      source of truth — same actions the autonomous engine uses), then
 *   2. broadcast the affected slot as a 28-byte CRVM packet via NetworkManager
 *      (UNCHANGED wire format — position + scale + tier, no new fields), and
 *   3. push the matching HUD event so the manual edit shows up in the stream
 *      exactly like an autonomous one.
 *
 * Keeping the broadcast + event here (not in the store) mirrors injectPhrase:
 * the store owns geometry/state, the lib layer owns the wire + telemetry. A
 * brand-new memory still goes through `injectPhrase` (classification path);
 * these are only the post-hoc edits a human triggers on an existing or empty
 * cell. Eviction is intentionally NOT broadcast — the position-only LWW apply
 * path can't represent a delete, so eviction stays a local, explicit act
 * (matching the existing /blast behaviour).
 */

import { useSaccadeStore, STRIDE } from "../store/useSaccadeStore";
import { useHudStore, pushHudEvent } from "../store/useHudStore";
import { NetworkManager } from "../network/NetworkManager";
import { injectPhrase, type InjectResult } from "./injectPhrase";
import { TIER_LABEL, TIER_BAND } from "./tierNarration";

function tierLabel(tier: number): string {
  return TIER_LABEL[Math.max(0, Math.min(4, tier - 1))];
}
function tierBand(tier: number): string {
  return TIER_BAND[Math.max(0, Math.min(4, tier - 1))];
}

/** Broadcast the current frame state of `index` as one 28-byte CRVM packet. */
function broadcastSlot(index: number): void {
  const s = useSaccadeStore.getState();
  const frame = s.mockFrames[s.activeFrameIndex];
  if (!frame) return;
  const off = index * STRIDE;
  NetworkManager.broadcastNodeUpdate(
    index,
    frame[off + 0],
    frame[off + 1],
    frame[off + 2],
    frame[off + 6],
    s.slotTier[index],
  );
  useHudStore.getState().incPacketsOut();
}

/**
 * Re-affirm an occupied cell ("seen again"). May promote a Theory/Dream, in
 * which case the memory migrates to a NEW slot index. Returns the resulting
 * slot index (the destination after a promotion, or the same slot otherwise),
 * or null if the slot was vacant / out of range — so a caller can keep its
 * selection pinned to the memory as it moves shells.
 */
export function reinforceSlotAt(slot: number): number | null {
  const outcome = useSaccadeStore.getState().reinforceSlot(slot);
  if (!outcome) return null;
  const label = tierLabel(outcome.tier);
  pushHudEvent({
    type: outcome.kind === "promote" ? "PROMOTE" : "REINFORCE",
    slot: outcome.index,
    tier: outcome.tier,
    detail:
      outcome.kind === "promote"
        ? `manually reinforced past the threshold → migrated inward to ${label} · vram[${outcome.index}]`
        : `manually reinforced — same idea re-affirmed · vram[${outcome.index}]`,
  });
  broadcastSlot(outcome.index);
  return outcome.index;
}

/** Migrate an occupied cell one shell inward (toward grounding). */
export function promoteSlotAt(slot: number): number | null {
  const dest = useSaccadeStore.getState().promoteSlotManual(slot);
  if (dest === null) return null;
  const tier = useSaccadeStore.getState().slotTier[dest];
  pushHudEvent({
    type: "PROMOTE",
    slot: dest,
    tier,
    detail: `manually promoted inward to ${tierLabel(tier)} (${tierBand(tier)}) · vram[${dest}]`,
  });
  broadcastSlot(dest);
  return dest;
}

/** Drift an occupied cell one shell outward (toward the Dream rim). */
export function demoteSlotAt(slot: number): number | null {
  const dest = useSaccadeStore.getState().demoteSlotManual(slot);
  if (dest === null) return null;
  const tier = useSaccadeStore.getState().slotTier[dest];
  pushHudEvent({
    type: "DEMOTE",
    slot: dest,
    tier,
    detail: `manually demoted outward to ${tierLabel(tier)} (${tierBand(tier)}) · vram[${dest}]`,
  });
  broadcastSlot(dest);
  return dest;
}

/** Evict (fade) a single occupied cell. Local-only (see file header). */
export function evictSlotAt(slot: number): boolean {
  const tier = useSaccadeStore.getState().slotTier[slot];
  const ok = useSaccadeStore.getState().evictSlot(slot);
  if (!ok) return false;
  pushHudEvent({
    type: "EVICT",
    slot,
    tier,
    detail: `manually evicted — faded the ${tierLabel(tier)} and returned its slot to the pool · vram[${slot}]`,
  });
  return true;
}

/**
 * Write a new memory into a chosen tier band (empty-cell "write"). Routes
 * through the SAME canonical `injectPhrase` path as every other text input —
 * classification still runs (surfacing confidence + cosine reinforcement), but
 * the spawn tier is forced to the clicked cell's band so the memory lands where
 * the operator aimed. Returns the inject result so the caller can re-select the
 * actual slot written.
 */
export function writeIntoBand(
  text: string,
  tier1Based: number,
): Promise<InjectResult> {
  return injectPhrase(text, "console", tier1Based);
}
