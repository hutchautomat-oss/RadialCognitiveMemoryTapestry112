/**
 * injectPhrase — single canonical path from a text phrase to a VRAM slot.
 *
 * Used by both the CommandConsole (user input) and ThoughtTicker
 * (autonomous loop). Serializes all callers via a single Promise chain so the
 * ONNX worker (which only allows one in-flight classification) is never
 * raced.
 *
 * Pipeline:
 *   1. await ONNX classify → { slot, similarities, latencyMs, embedding }
 *   2. inject into useSaccadeStore via injectLiveIntentVector (the ONLY
 *      authorized VRAM write path — never bypass this).
 *   3. broadcast a 28-byte CRVM packet via NetworkManager (sync core).
 *   4. push HUD events: SPAWN | REINFORCE | EVICT | PROMOTE, AXIOM if
 *      the source is the boot seed, LOW_CONF if confidence < threshold.
 *
 * Note: this path deliberately bypasses the legacy useStore.addNode graph.
 * The legacy/VRAM parity invariant will show the divergence — that is
 * intentional. Task #4 retires the legacy graph entirely.
 */

import { useSaccadeStore, STRIDE } from "../store/useSaccadeStore";
import { useHudStore, pushHudEvent } from "../store/useHudStore";
import { OnnxWorker, colorForSlot } from "../workers/OnnxWorkerManager";
import { NetworkManager } from "../network/NetworkManager";

const LOW_CONF_THRESHOLD = 0.55;
const TIER_NAMES = ["FACT", "SCENARIO", "METRIC", "THEORY", "DREAM"];

export type InjectSource = "console" | "ticker" | "axiom";

export interface InjectResult {
  slot: number;
  vramIndex: number | null;
  latencyMs: number;
  confidence: number;
  kind: "spawn" | "reinforce" | "evict" | "promote" | "rejected";
}

// Single in-flight chain serializes both console and ticker callers.
let chain: Promise<unknown> = Promise.resolve();

export function injectPhrase(
  text: string,
  source: InjectSource = "console",
): Promise<InjectResult> {
  const next = chain.then(() => doInject(text, source));
  // Catch so a single failure doesn't poison the chain forever.
  chain = next.catch(() => undefined);
  return next;
}

async function doInject(
  text: string,
  source: InjectSource,
): Promise<InjectResult> {
  useHudStore.getState().setTickerBusy(true);
  try {
    // 1. Classify.
    const cls = await OnnxWorker.classify(text);
    // Axiom seeds are FORCED to Fact tier (slot=1) regardless of classifier
    // output — they're foundational facts and must land in the foveated core.
    // The classifier confidence is still surfaced so an axiom that the model
    // would have routed elsewhere still raises a LOW_CONF event below.
    const slot = source === "axiom" ? 1 : cls.slot;
    const similarities = cls.similarities;
    const latencyMs = cls.latencyMs;
    const embedding = cls.embedding;

    const tierIdx = Math.max(0, Math.min(4, slot - 1));
    const confidence = similarities.length > tierIdx ? similarities[tierIdx] : 0;

    // 2. Inject (the only authorized VRAM write path).
    const color = colorForSlot(slot);
    const outcome = useSaccadeStore.getState().injectLiveIntentVector({
      slot,
      textLength: text.length,
      colorRGB: color,
      embedding,
      phrase: text,
    });

    if (outcome === null) {
      pushHudEvent({
        type: "ERROR",
        phrase: previewPhrase(text),
        detail: `tier ${TIER_NAMES[tierIdx]} full and no eviction candidate`,
      });
      return {
        slot,
        vramIndex: null,
        latencyMs,
        confidence,
        kind: "rejected",
      };
    }

    // 3. Emit canonical event for this outcome.
    const tierLabel = TIER_NAMES[Math.max(0, Math.min(4, outcome.tier - 1))];
    if (source === "axiom") {
      pushHudEvent({
        type: "AXIOM",
        slot: outcome.index,
        tier: outcome.tier,
        phrase: previewPhrase(text),
        detail: `axiom seed @ vram[${outcome.index}] (${tierLabel})`,
      });
    } else {
      pushHudEvent({
        type:
          outcome.kind === "reinforce"
            ? "REINFORCE"
            : outcome.kind === "evict"
              ? "EVICT"
              : outcome.kind === "promote"
                ? "PROMOTE"
                : "SPAWN",
        slot: outcome.index,
        tier: outcome.tier,
        phrase: previewPhrase(text),
        detail:
          outcome.kind === "reinforce"
            ? `+Δmass @ vram[${outcome.index}] (${tierLabel})`
            : outcome.kind === "evict"
              ? `${tierLabel} full → evicted lowest-health → vram[${outcome.index}]`
              : outcome.kind === "promote"
                ? `promoted inward → vram[${outcome.index}] (${tierLabel})`
                : `${tierLabel} · ${latencyMs.toFixed(0)}ms · conf ${confidence.toFixed(2)}`,
      });
    }

    if (confidence > 0 && confidence < LOW_CONF_THRESHOLD) {
      pushHudEvent({
        type: "LOW_CONF",
        slot: outcome.index,
        tier: outcome.tier,
        phrase: previewPhrase(text),
        detail: `conf ${confidence.toFixed(2)} < ${LOW_CONF_THRESHOLD} — routing is guessing`,
      });
    }

    // 4. Broadcast — uses VRAM slot index, not legacy graph.
    const state = useSaccadeStore.getState();
    const frame = state.mockFrames[state.activeFrameIndex];
    if (frame) {
      const off = outcome.index * STRIDE;
      NetworkManager.broadcastNodeUpdate(
        outcome.index,
        frame[off + 0],
        frame[off + 1],
        frame[off + 2],
        frame[off + 6],
        outcome.tier,
      );
      useHudStore.getState().incPacketsOut();
    }

    return {
      slot,
      vramIndex: outcome.index,
      latencyMs,
      confidence,
      kind: outcome.kind,
    };
  } finally {
    useHudStore.getState().setTickerBusy(false);
  }
}

function previewPhrase(text: string): string {
  return text.length > 56 ? text.slice(0, 53) + "…" : text;
}
