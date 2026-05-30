/**
 * Guard: search must never silently degrade memory classification.
 *
 * The `/find` semantic-search command added an EMBED worker op that ends with
 * its own completion status (EMBED_COMPLETE). `isReady` derives "model is warm"
 * by enumerating *transient* completion statuses, so a new op whose status is
 * NOT listed there flips `isReady` false on the very next `classify()` — which
 * then silently takes the keyword fallback (embedding: null), no error, no log.
 * See `.agents/memory/onnx-transient-status-readiness.md`.
 *
 * These tests pin two things:
 *   1. After an embed/search op completes, `classify()` still routes through the
 *      real model (posts CLASSIFY, returns a non-null embedding) — not the
 *      keyword fallback.
 *   2. EVERY completion status the worker actually emits (scanned from the
 *      worker source) keeps `isReady` true. Add a new worker op + completion
 *      status without wiring it into `isReady`, and this test fails — at
 *      runtime, not just at typecheck (test files are excluded from tsc).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  OnnxWorker,
  type OnnxStatus,
  type OnnxStatusPayload,
} from "./OnnxWorkerManager";

/**
 * Minimal stand-in for the real module Worker. Captures everything posted to it
 * and lets the test drive status events back into the manager exactly as the
 * real worker would via `onmessage`.
 */
class FakeWorker {
  onmessage: ((e: MessageEvent<OnnxStatusPayload>) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  posted: Array<{ command?: string; payload?: unknown }> = [];

  postMessage(msg: { command?: string; payload?: unknown }) {
    this.posted.push(msg);
  }

  terminate() {}

  /** Simulate the worker emitting a status back to the manager. */
  emit(payload: OnnxStatusPayload) {
    this.onmessage?.({ data: payload } as MessageEvent<OnnxStatusPayload>);
  }
}

let fake: FakeWorker;

beforeEach(() => {
  fake = new FakeWorker();
  // The manager calls `new Worker(new URL(...), { type: "module" })`; hand it
  // our fake instead of spinning up a real ONNX worker in the node test env.
  // Must be a regular (constructable) function — a constructor that returns an
  // object makes `new` yield that object. An arrow fn would throw "not a
  // constructor".
  vi.stubGlobal("Worker", function MockWorker() {
    return fake;
  });
  // Reset the module singleton to a clean IDLE state, then re-create the worker.
  OnnxWorker.terminate();
  OnnxWorker.initialize();
});

afterEach(() => {
  OnnxWorker.terminate();
  vi.unstubAllGlobals();
});

describe("OnnxWorker readiness vs. silent classification fallback", () => {
  it("falls back to the keyword heuristic (embedding: null) before the model is warm", async () => {
    expect(OnnxWorker.isReady).toBe(false);

    const result = await OnnxWorker.classify("a pass or fail metric result");

    // Keyword fallback: no model embedding, and nothing was sent to the worker.
    expect(result.embedding).toBeNull();
    expect(fake.posted.some((m) => m.command === "CLASSIFY")).toBe(false);
  });

  it("keeps using the real model path for classify() AFTER an embed/search op (the /find regression)", async () => {
    // Warm the pipeline.
    fake.emit({ status: "READY" });
    expect(OnnxWorker.isReady).toBe(true);

    // Simulate a `/find`: an EMBED op completes. This transient status is the
    // one that historically flipped isReady false and degraded later classify().
    fake.emit({ status: "EMBED_COMPLETE", embedding: new Float32Array(384) });
    expect(OnnxWorker.isReady).toBe(true);

    // Now classify() must route through the worker (real model), not fall back.
    const pending = OnnxWorker.classify("a verified fact that already happened");

    const classifyMsg = fake.posted.find((m) => m.command === "CLASSIFY");
    expect(classifyMsg).toBeDefined();

    // Drive the worker's response and assert a non-null embedding came back —
    // proof the model path ran (the keyword fallback returns null).
    const modelEmbedding = new Float32Array(384);
    modelEmbedding[0] = 1;
    fake.emit({
      status: "CLASSIFY_COMPLETE",
      slot: 1,
      similarities: [0.9, 0, 0, 0, 0],
      latencyMs: 2,
      embedding: modelEmbedding,
    });

    const result = await pending;
    expect(result.embedding).not.toBeNull();
    expect(result.embedding?.length).toBe(384);
    expect(result.slot).toBe(1);
  });

  it("treats EVERY completion status the worker emits as 'ready' (fails if a new op's status is added without wiring isReady)", () => {
    // Scan the worker source for every status it actually posts back. This is
    // the runtime guard: a new worker op that emits a fresh completion status
    // shows up here automatically.
    const workerSrc = readFileSync(
      fileURLToPath(new URL("./onnxInference.worker.ts", import.meta.url)),
      "utf8",
    );
    const emitted = new Set(
      [...workerSrc.matchAll(/status:\s*"([A-Z_]+)"/g)].map((m) => m[1]),
    );

    // A status emitted AFTER the model is warm — READY plus any op-completion
    // (*_COMPLETE) — implies the pipeline is loaded and ready for the next op.
    // If any such status leaves isReady false, the next classify() silently
    // drops to the keyword fallback.
    const warmCompletionStatuses = [...emitted].filter(
      (s) => s === "READY" || s.endsWith("_COMPLETE"),
    );

    // Sanity: the scan found the known completion statuses (so a broken regex
    // can't make this guard vacuously pass).
    expect(warmCompletionStatuses).toEqual(
      expect.arrayContaining(["READY", "CLASSIFY_COMPLETE", "EMBED_COMPLETE"]),
    );

    for (const status of warmCompletionStatuses) {
      fake.emit({ status: status as OnnxStatus });
      expect(
        OnnxWorker.isReady,
        `worker emits "${status}" after warm-up, but isReady is false — classify() will silently fall back to the keyword heuristic. Add "${status}" to OnnxWorker.isReady.`,
      ).toBe(true);
    }
  });

  it("stays NOT ready for pre-warm and error statuses (fallback is intentional there)", () => {
    for (const status of ["IDLE", "LOADING", "COMPILING", "ERROR"] as const) {
      fake.emit({ status });
      expect(OnnxWorker.isReady, `status=${status}`).toBe(false);
    }
  });
});
