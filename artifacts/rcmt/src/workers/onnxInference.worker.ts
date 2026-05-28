/**
 * RCMT ONNX Inference Worker (TS module worker)
 *
 * Loads Xenova/all-MiniLM-L6-v2 feature-extraction pipeline, embeds 5 prototype
 * seed phrases at warmup, then routes incoming text to one of slots 1..5 via
 * cosine similarity (= dot product, since embeddings are L2-normalized).
 *
 * Message protocol:
 *   in:  { command: "INITIALIZE_AND_WARM" }
 *   in:  { command: "CLASSIFY", payload: { text: string } }
 *   out: { status: "LOADING" | "COMPILING" | "READY" | ... , message? }
 *   out: { status: "CLASSIFY_COMPLETE", slot, similarities, latencyMs }
 *   out: { status: "ERROR", error }
 */

import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";

// Models load from the HF CDN; no local model cache in /public required.
env.allowLocalModels = false;

// 5-D Intent-State Ontology (RCMT spec). Order matters: slot 1..5.
const SEED_PHRASES = [
  "a verified fact that has already happened",          // Slot 1: Facts / Executions
  "a comparison between expected and actual outcome",    // Slot 2: Scenario vs Reality
  "a pass or fail measurement result",                   // Slot 3: Pass/Fail Metrics
  "a theory or plan for what should happen next",        // Slot 4: Theories / Plans
  "a dream or speculative inspiration",                  // Slot 5: Dreams / Inspirations
];

let extractor: FeatureExtractionPipeline | null = null;
let prototypes: Float32Array[] = []; // 5 × 384, L2-normalized

function dot(a: Float32Array | number[], b: Float32Array | number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

async function embed(text: string): Promise<Float32Array> {
  if (!extractor) throw new Error("Pipeline not initialized");
  const out = await extractor(text, { pooling: "mean", normalize: true });
  // Always clone into a fresh Float32Array: (a) defends against pipeline
  // buffer reuse on the next inference, (b) defends against future
  // transformers.js versions returning a different typed-array variant.
  return new Float32Array(out.data as ArrayLike<number>);
}

self.onmessage = async (e: MessageEvent) => {
  const { command, payload } = e.data ?? {};

  try {
    if (command === "INITIALIZE_AND_WARM") {
      self.postMessage({
        status: "LOADING",
        message: "Fetching Xenova/all-MiniLM-L6-v2 (quantized) from HF CDN...",
      });

      extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { quantized: true },
      );

      self.postMessage({
        status: "COMPILING",
        message: "Embedding 5 prototype seed phrases...",
      });

      const warmStart = performance.now();
      prototypes = [];
      for (const phrase of SEED_PHRASES) {
        const v = await embed(phrase);
        // Clone since the underlying buffer may be reused by the pipeline.
        prototypes.push(new Float32Array(v));
      }
      const warmMs = performance.now() - warmStart;

      self.postMessage({
        status: "READY",
        message: `Pipeline + prototypes ready in ${warmMs.toFixed(1)}ms`,
      });
      return;
    }

    if (command === "CLASSIFY") {
      if (!extractor || prototypes.length !== 5) {
        throw new Error("CLASSIFY called before INITIALIZE_AND_WARM completed");
      }
      const text: string = payload?.text ?? "";
      if (!text.trim()) {
        throw new Error("Empty text");
      }

      const t0 = performance.now();
      const v = await embed(text);

      // Cosine similarity (= dot since normalize:true on both sides).
      const sims: number[] = prototypes.map((p) => dot(v, p));
      let bestIdx = 0;
      for (let i = 1; i < sims.length; i++) {
        if (sims[i] > sims[bestIdx]) bestIdx = i;
      }
      const latencyMs = performance.now() - t0;

      // Ship the embedding back as a transferable so the main thread can
      // store it for per-slot cosine reinforcement. v is L2-normalized
      // already (pipeline call used normalize: true).
      const embeddingCopy = new Float32Array(v);
      self.postMessage(
        {
          status: "CLASSIFY_COMPLETE",
          slot: bestIdx + 1, // 1..5
          similarities: sims,
          latencyMs,
          embedding: embeddingCopy,
        },
        { transfer: [embeddingCopy.buffer] },
      );
      return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    self.postMessage({ status: "ERROR", error: msg });
  }
};

// Help TS see this as a module
export {};
