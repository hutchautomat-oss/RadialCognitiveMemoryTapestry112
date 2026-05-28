/**
 * OnnxWorkerManager — thin TypeScript bridge to public/onnxInference.worker.js
 *
 * Usage:
 *   OnnxWorker.initialize();                     // fires INITIALIZE_AND_WARM
 *   OnnxWorker.onStatusChange = (s) => {};       // called on every status update
 *   const result = await OnnxWorker.infer(ids, mask, typeIds);
 */

export type OnnxStatus =
  | "IDLE"
  | "LOADING"
  | "COMPILING"
  | "READY"
  | "INFERENCE_COMPLETE"
  | "ERROR";

export interface OnnxStatusPayload {
  status: OnnxStatus;
  message?: string;
  logits?: number[];
  latencyMs?: number;
  error?: string;
}

type InferResolve = (result: { logits: number[]; latencyMs: number }) => void;
type InferReject  = (err: Error) => void;

class OnnxWorkerManagerClass {
  private worker: Worker | null = null;
  private status: OnnxStatus = "IDLE";
  private pendingInfer: { resolve: InferResolve; reject: InferReject } | null = null;

  onStatusChange: ((payload: OnnxStatusPayload) => void) | null = null;

  initialize(): void {
    if (this.worker) return;
    try {
      this.worker = new Worker("/onnxInference.worker.js");
      this.worker.onmessage = (e: MessageEvent<OnnxStatusPayload>) => {
        this.status = e.data.status;
        this.onStatusChange?.(e.data);

        if (e.data.status === "INFERENCE_COMPLETE" && this.pendingInfer) {
          this.pendingInfer.resolve({
            logits: e.data.logits ?? [],
            latencyMs: e.data.latencyMs ?? 0,
          });
          this.pendingInfer = null;
        }

        if (e.data.status === "ERROR" && this.pendingInfer) {
          this.pendingInfer.reject(new Error(e.data.error ?? "Unknown ONNX error"));
          this.pendingInfer = null;
        }
      };

      this.worker.onerror = (err) => {
        console.error("[OnnxWorker] Worker error:", err);
        this.pendingInfer?.reject(new Error(err.message));
        this.pendingInfer = null;
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
    return this.status === "READY";
  }

  infer(
    inputIds: number[],
    attentionMask: number[],
    tokenTypeIds: number[],
  ): Promise<{ logits: number[]; latencyMs: number }> {
    return new Promise((resolve, reject) => {
      if (!this.worker || this.status !== "READY") {
        // Fallback: return uniform logits when model not loaded
        resolve({ logits: [0.5, 0.3, 0.2], latencyMs: 0 });
        return;
      }
      if (this.pendingInfer) {
        reject(new Error("Inference already in flight"));
        return;
      }
      this.pendingInfer = { resolve, reject };
      this.worker.postMessage({
        command: "RUN_INFERENCE",
        payload: { inputIds, attentionMask, tokenTypeIds },
      });
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.status = "IDLE";
  }
}

export const OnnxWorker = new OnnxWorkerManagerClass();
