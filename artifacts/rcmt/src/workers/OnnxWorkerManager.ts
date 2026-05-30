/**
 * OnnxWorkerManager — TS bridge to the ONNX module worker.
 *
 * The worker hosts @xenova/transformers (MiniLM-L6-v2) and routes text to one
 * of 5 ontology slots via cosine similarity to pre-embedded prototypes.
 *
 * Usage:
 *   OnnxWorker.initialize();
 *   OnnxWorker.onStatusChange = (s) => {};
 *   const { slot, latencyMs } = await OnnxWorker.classify("some text");
 */

export type OnnxStatus =
  | "IDLE"
  | "LOADING"
  | "COMPILING"
  | "READY"
  | "CLASSIFY_COMPLETE"
  | "ERROR";

export interface OnnxStatusPayload {
  status: OnnxStatus;
  message?: string;
  slot?: number;
  similarities?: number[];
  latencyMs?: number;
  embedding?: Float32Array;
  error?: string;
}

export interface ClassifyResult {
  slot: number; // 1..5
  similarities: number[];
  latencyMs: number;
  /** L2-normalized 384-d MiniLM embedding (transferred from the worker). */
  embedding: Float32Array | null;
}

type ClassifyResolve = (r: ClassifyResult) => void;
type ClassifyReject = (err: Error) => void;

class OnnxWorkerManagerClass {
  private worker: Worker | null = null;
  private status: OnnxStatus = "IDLE";
  private pending: { resolve: ClassifyResolve; reject: ClassifyReject } | null = null;

  onStatusChange: ((payload: OnnxStatusPayload) => void) | null = null;

  initialize(): void {
    if (this.worker) return;
    try {
      this.worker = new Worker(
        new URL("./onnxInference.worker.ts", import.meta.url),
        { type: "module" },
      );

      this.worker.onmessage = (e: MessageEvent<OnnxStatusPayload>) => {
        this.status = e.data.status;
        this.onStatusChange?.(e.data);

        if (e.data.status === "CLASSIFY_COMPLETE" && this.pending) {
          this.pending.resolve({
            slot: e.data.slot ?? 3,
            similarities: e.data.similarities ?? [],
            latencyMs: e.data.latencyMs ?? 0,
            embedding: e.data.embedding ?? null,
          });
          this.pending = null;
        }

        if (e.data.status === "ERROR" && this.pending) {
          this.pending.reject(new Error(e.data.error ?? "Unknown ONNX error"));
          this.pending = null;
        }
      };

      this.worker.onerror = (err) => {
        console.error("[OnnxWorker] Worker error:", err);
        this.pending?.reject(new Error(err.message));
        this.pending = null;
      };

      this.worker.postMessage({ command: "INITIALIZE_AND_WARM" });
    } catch (err) {
      console.warn("[OnnxWorker] Could not create worker:", err);
    }
  }

  get currentStatus(): OnnxStatus {
    return this.status;
  }

  get isReady(): boolean {
    return this.status === "READY" || this.status === "CLASSIFY_COMPLETE";
  }

  /**
   * Classify text → slot (1..5). Falls back to keyword heuristic if the
   * pipeline isn't loaded yet (model is ~25MB; first call from CDN may take
   * a few seconds).
   */
  classify(text: string): Promise<ClassifyResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker || !this.isReady) {
        resolve({
          slot: keywordFallbackSlot(text),
          similarities: [],
          latencyMs: 0,
          embedding: null,
        });
        return;
      }
      if (this.pending) {
        reject(new Error("Classification already in flight"));
        return;
      }
      this.pending = { resolve, reject };
      this.worker.postMessage({ command: "CLASSIFY", payload: { text } });
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.status = "IDLE";
  }
}

/**
 * Quick keyword heuristic used until the ONNX pipeline finishes warming.
 * Mirrors the 5-D ontology in spirit so the visual stays sensible during
 * model download.
 */
function keywordFallbackSlot(text: string): number {
  const t = text.toLowerCase();
  if (/\b(fact|happened|did|was|is|executed|done|confirmed)\b/.test(t)) return 1;
  if (/\b(versus|vs|compared|expected|actual|reality|scenario)\b/.test(t)) return 2;
  if (/\b(pass|fail|metric|score|result|test|passed|failed)\b/.test(t)) return 3;
  if (/\b(plan|theory|should|will|going to|propose|hypothesis)\b/.test(t)) return 4;
  if (/\b(dream|imagine|maybe|wish|hope|inspire|what if|someday)\b/.test(t)) return 5;
  return 3; // neutral middle slot
}

// The canonical tier palette now lives in useSaccadeStore (TIER_RGB) so node
// color has a single source of truth; injectPhrase reads it directly.

export const OnnxWorker = new OnnxWorkerManagerClass();
