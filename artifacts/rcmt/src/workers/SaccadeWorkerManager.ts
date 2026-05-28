/**
 * SaccadeWorkerManager — thin TypeScript bridge to public/saccadeIndexer.worker.js
 *
 * Usage:
 *   SaccadeWorker.loadFile(fileHandle);
 *   SaccadeWorker.seekFrame(42, (data) => applyToScene(data));
 */

export interface FrameData {
  index: number;
  /** Float32Array: [x,y,z, certainty, r,g,b] × 8000 nodes = 56,000 floats */
  data: Float32Array;
}

export type SaccadeStatus = "IDLE" | "FILE_READY" | "FRAME_DATA" | "RANGE_DATA" | "ERROR";

export interface SaccadeStatusPayload {
  status: SaccadeStatus;
  totalFrames?: number;
  fileSizeBytes?: number;
  index?: number;
  data?: Float32Array;
  frames?: FrameData[];
  error?: string;
}

class SaccadeWorkerManagerClass {
  private worker: Worker | null = null;
  private totalFrames = 0;
  private seekCallbacks = new Map<number, (data: Float32Array) => void>();

  onFileReady: ((totalFrames: number, fileSizeBytes: number) => void) | null = null;
  onFrameData: ((frame: FrameData) => void) | null = null;
  onError: ((msg: string) => void) | null = null;

  initialize(): void {
    if (this.worker) return;
    try {
      this.worker = new Worker("/saccadeIndexer.worker.js");
      this.worker.onmessage = (e: MessageEvent<SaccadeStatusPayload>) => {
        const msg = e.data;
        switch (msg.status) {
          case "FILE_READY":
            this.totalFrames = msg.totalFrames ?? 0;
            this.onFileReady?.(this.totalFrames, msg.fileSizeBytes ?? 0);
            break;
          case "FRAME_DATA":
            if (msg.index !== undefined && msg.data) {
              const frame: FrameData = { index: msg.index, data: msg.data };
              this.onFrameData?.(frame);
              this.seekCallbacks.get(msg.index)?.(msg.data);
              this.seekCallbacks.delete(msg.index);
            }
            break;
          case "RANGE_DATA":
            msg.frames?.forEach((f) => {
              this.onFrameData?.(f);
              this.seekCallbacks.get(f.index)?.(f.data);
              this.seekCallbacks.delete(f.index);
            });
            break;
          case "ERROR":
            console.error("[SaccadeWorker]", msg.error);
            this.onError?.(msg.error ?? "Unknown error");
            break;
        }
      };

      this.worker.onerror = (err) => {
        console.error("[SaccadeWorker] Worker error:", err);
        this.onError?.(err.message);
      };
    } catch (err) {
      console.warn("[SaccadeWorker] Could not create worker:", err);
    }
  }

  loadFile(file: File): void {
    if (!this.worker) this.initialize();
    this.worker?.postMessage({ command: "INITIALIZE_FILE", payload: { fileHandle: file } });
  }

  seekFrame(frameIndex: number, cb?: (data: Float32Array) => void): void {
    if (!this.worker) return;
    if (cb) this.seekCallbacks.set(frameIndex, cb);
    this.worker.postMessage({ command: "SEEK_FRAME", payload: { frameIndex } });
  }

  preloadRange(startFrame: number, endFrame: number): void {
    if (!this.worker) return;
    this.worker.postMessage({
      command: "PRELOAD_RANGE",
      payload: { startFrame, endFrame },
    });
  }

  get frameCount(): number {
    return this.totalFrames;
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.totalFrames = 0;
  }
}

export const SaccadeWorker = new SaccadeWorkerManagerClass();
