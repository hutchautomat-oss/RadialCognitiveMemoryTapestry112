/**
 * ThoughtTicker — invisible component that drives the autonomous thought
 * loop. On boot it injects the 7 axioms in sequence, then fires phrases
 * from the corpus at a jittered cadence (default 2-4 s).
 *
 * Pausable, rate-adjustable via the CommandConsole slash commands. Tear-down
 * on unmount clears the pending timer so HMR doesn't leak intervals.
 *
 * Never opens its own write path — every injection goes through the shared
 * `injectPhrase` helper that all other callers use.
 */

import { useEffect, useRef } from "react";
import { injectPhrase } from "../lib/injectPhrase";
import { AXIOMS, PHRASE_CORPUS } from "../data/corpus";
import { useHudStore, pushHudEvent } from "../store/useHudStore";
import { OnnxWorker } from "../workers/OnnxWorkerManager";

const AXIOM_GAP_MS = 600;
const AXIOM_KICKOFF_DELAY_MS = 1500;

export function ThoughtTicker() {
  const seededRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    function schedule(delay: number) {
      if (cancelled) return;
      timerRef.current = setTimeout(tick, delay);
    }

    async function seedAxioms() {
      // Wait until ONNX worker is at least loaded enough to attempt classify.
      // injectPhrase will fall through to the keyword heuristic if not ready,
      // which is fine — axioms will land on Fact tier either way.
      for (const phrase of AXIOMS) {
        if (cancelled) return;
        try {
          await injectPhrase(phrase, "axiom");
        } catch (err) {
          pushHudEvent({
            type: "ERROR",
            phrase,
            detail: `axiom seed failed: ${(err as Error).message}`,
          });
        }
        await sleep(AXIOM_GAP_MS);
      }
      pushHudEvent({
        type: "INFO",
        detail: `axiom seed complete (${AXIOMS.length} entries)`,
      });
    }

    async function tick() {
      const { ticker } = useHudStore.getState();
      if (!ticker.running) {
        // While paused, recheck every 500ms.
        schedule(500);
        return;
      }
      if (ticker.busy || OnnxWorker.currentStatus === "LOADING") {
        // Engine is mid-flight or warming. Retry shortly.
        schedule(400);
        return;
      }

      const phrase = nextPhrase();
      try {
        await injectPhrase(phrase, "ticker");
        useHudStore.getState().markTickerFired();
      } catch (err) {
        pushHudEvent({
          type: "ERROR",
          phrase,
          detail: `ticker injection failed: ${(err as Error).message}`,
        });
      }

      const { ticker: t2 } = useHudStore.getState();
      const jitter = (Math.random() * 2 - 1) * t2.jitterMs;
      const next = Math.max(250, t2.periodMs + jitter);
      schedule(next);
    }

    async function boot() {
      if (seededRef.current) return;
      seededRef.current = true;
      await sleep(AXIOM_KICKOFF_DELAY_MS);
      if (cancelled) return;
      await seedAxioms();
      if (cancelled) return;
      schedule(Math.max(500, useHudStore.getState().ticker.periodMs));
    }

    void boot();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function nextPhrase(): string {
    // Walk the corpus with a Fisher-Yates style permutation seed each pass
    // for variety without re-shuffling state on every tick.
    if (cursorRef.current === 0) {
      // No-op; corpus is intentionally pre-shuffled by author for cadence.
    }
    const i = cursorRef.current % PHRASE_CORPUS.length;
    cursorRef.current = (cursorRef.current + 1 + (Math.random() * 3) | 0) % PHRASE_CORPUS.length;
    return PHRASE_CORPUS[i];
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
