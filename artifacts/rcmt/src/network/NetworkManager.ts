/**
 * RCMT NetworkManager — CRVM LWW WebSocket client
 *
 * 28-byte CRVM stride per node:
 *   Bytes  0- 1: nodeIndex / slotIndex  (Uint16LE)
 *   Bytes  2- 3: intentId               (Uint16LE, 0=unknown, 1=Fact..5=Dream)
 *   Bytes  4- 7: x                      (Float32LE)
 *   Bytes  8-11: y                      (Float32LE)
 *   Bytes 12-15: z                      (Float32LE)
 *   Bytes 16-19: mass / scale           (Float32LE)
 *   Bytes 20-27: lwwTimestamp           (Float64LE, ms since epoch)
 *
 * Master buffer strategy:
 *   - Pre-allocate 224,000 bytes (8000 × 28 bytes)
 *   - On HELLO, server sends full state
 *   - Incoming 28-byte packets are copied directly into the buffer
 *   - Renderer reads directly from this buffer (zero-copy)
 *   - React store is notified only for non-spatial mutations
 */

import { useHudStore } from "../store/useHudStore";
import { useSaccadeStore } from "../store/useSaccadeStore";

const MAX_NODES = 8000;
const STRIDE_BYTES = 28;
const MASTER_BUFFER_SIZE = MAX_NODES * STRIDE_BYTES; // 224,000 bytes
const RECONNECT_DELAY_MS = 3000;

class NetworkManagerClass {
  private socket: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // peerId assigned by the server on HELLO. -1 until the handshake completes.
  // Used only for logging/debug; never written into the packet.
  private peerId = -1;
  // Zero-copy master buffer: renderer reads directly from this
  private masterBuffer = new Uint8Array(MASTER_BUFFER_SIZE);
  // DataView wrapper for safe, unaligned reads across the entire master buffer.
  // The LWW timestamp sits at offset 20 within each 28-byte stride, which violates
  // native Float64Array alignment (20 ≡ 4 mod 8). DataView with explicit
  // little-endian (true) parameter safely bypasses alignment constraints.
  private masterView = new DataView(this.masterBuffer.buffer);

  connect(): void {
    if (this.socket) return;

    // VITE_WS_URL is the Render sync-server base (e.g. wss://….onrender.com).
    // Falls back to same-host for local dev (Replit/Codespaces proxy).
    const envBase = (import.meta.env.VITE_WS_URL as string | undefined)?.replace(/\/$/, "");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = envBase
      ? `${envBase}/socket`
      : `${protocol}//${window.location.host}/socket`;

    try {
      this.socket = new WebSocket(url);
      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {
        this.connected = true;
        console.info("[RCMT] Sync core connected — awaiting HELLO");
      };

      this.socket.onmessage = (evt) => {
        // Handle control frames (HELLO, STALE_REJECT) — JSON text
        if (typeof evt.data === "string") {
          this.handleControl(evt.data);
          return;
        }

        // Handle binary frames
        if (evt.data instanceof ArrayBuffer) {
          // Full state sync (224KB): server sends on HELLO
          if (evt.data.byteLength === MASTER_BUFFER_SIZE) {
            this.masterBuffer.set(new Uint8Array(evt.data));
            // Re-wrap the DataView after buffer mutation to ensure coherence
            console.info("[RCMT] Full state sync received");
            // Signal React that buffer has changed
            window.dispatchEvent(new CustomEvent("rcmt-buffer-dirty"));
            return;
          }

          // Atomic vector update (28 bytes)
          if (evt.data.byteLength === STRIDE_BYTES) {
            const incomingArray = new Uint8Array(evt.data);
            const incomingView = new DataView(evt.data);

            // Safe Unaligned Read: Extract the target nodeIndex (Uint16LE at offset 0)
            const nodeIndex = incomingView.getUint16(0, true);

            // Safe Unaligned Read: Extract the incoming 64-bit LWW Timestamp
            // Offset 20 violates native alignment (20 ≡ 4 mod 8), but DataView
            // with little-endian=true safely extracts the double-precision float.
            const incomingTimestamp = incomingView.getFloat64(20, true);

            if (nodeIndex < MAX_NODES) {
              // Server has already arbitrated; apply the update directly to master buffer
              this.masterBuffer.set(incomingArray, nodeIndex * STRIDE_BYTES);
              
              // Refresh the local view of the timestamp for next read
              const localTimestamp = this.masterView.getFloat64(
                nodeIndex * STRIDE_BYTES + 20,
                true
              );
              console.debug(
                `[RCMT] Applied update to slot ${nodeIndex}, LWW ts=${incomingTimestamp.toFixed(0)}`
              );

              this.notifyRemoteFlash(nodeIndex);
              window.dispatchEvent(new CustomEvent("rcmt-buffer-dirty"));
              useHudStore.getState().incPacketsIn(1);
            }
            return;
          }
        }
      };

      this.socket.onclose = () => {
        this.connected = false;
        this.peerId = -1;
        this.socket = null;
        console.warn("[RCMT] Sync core disconnected — reconnecting in", RECONNECT_DELAY_MS, "ms");
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      };

      this.socket.onerror = (err) => {
        console.error("[RCMT] WS error", err);
      };
    } catch (err) {
      console.error("[RCMT] Failed to create WebSocket", err);
      this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.peerId = -1;
  }

  /**
   * Broadcast a node update. Sends a strict 28-byte atomic packet.
   * `intentId` defaults to 0 (unknown) for legacy call sites (drag, position update).
   * ONNX-injection broadcasts should pass the classified slot (1..5).
   * 
   * The outbound packet uses DataView with little-endian byte ordering to safely
   * write the 64-bit LWW timestamp at the unaligned offset 20.
   */
  broadcastNodeUpdate(
    index: number,
    x: number,
    y: number,
    z: number,
    scale: number,
    intentId: number = 0,
  ): void {
    if (!this.connected || !this.socket) return;

    const buf = new ArrayBuffer(STRIDE_BYTES);
    const view = new DataView(buf);

    // Populate the 28-Byte Stride (Strictly Little-Endian)
    view.setUint16(0, index, true);
    view.setUint16(2, intentId & 0xffff, true);
    view.setFloat32(4, x, true);
    view.setFloat32(8, y, true);
    view.setFloat32(12, z, true);
    view.setFloat32(16, scale, true);

    // Safe Unaligned Write: Inject the 64-bit LWW Timestamp at offset 20.
    // Offset 20 violates native Float64Array alignment (20 ≡ 4 mod 8).
    // DataView with little-endian=true safely handles the unaligned write.
    view.setFloat64(20, Date.now(), true);

    try {
      this.socket.send(buf);
      // Optimistically apply locally
      this.masterBuffer.set(new Uint8Array(buf), index * STRIDE_BYTES);
      window.dispatchEvent(new CustomEvent("rcmt-buffer-dirty"));
    } catch (err) {
      console.error("[RCMT] Send error", err);
    }
  }

  /**
   * Get read-only access to the master buffer for the renderer.
   * Renderer uses this to upload to VRAM without copying.
   */
  getMasterBuffer(): Uint8Array {
    return this.masterBuffer;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get assignedPeerId(): number {
    return this.peerId;
  }

  private notifyRemoteFlash(nodeIndex: number): void {
    // Queue a peripheral-motion cue: a remote peer just mutated a node.
    // PeripheralFlashBridge drains this each frame and flashes the edge.
    const { slotTier } = useSaccadeStore.getState();
    const tier = slotTier[nodeIndex] ?? 1;
    
    // Read position from master buffer using safe unaligned access
    const offset = nodeIndex * STRIDE_BYTES;
    const x = this.masterView.getFloat32(offset + 4, true);
    const y = this.masterView.getFloat32(offset + 8, true);
    const z = this.masterView.getFloat32(offset + 12, true);

    useSaccadeStore.getState().pushRemoteFlash({ x, y, z, tier });
  }

  private handleControl(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      if (msg && msg.type === "HELLO" && typeof msg.peerId === "number") {
        this.peerId = msg.peerId;
        console.info("[RCMT] HELLO — assigned peer", this.peerId);
        useHudStore.getState().setNet({
          connected: true,
          peerId: this.peerId,
          lastHelloAt: Date.now(),
        });
        useHudStore.getState().pushEvent({
          type: "INFO",
          detail: `HELLO accepted — assigned peer ${this.peerId}`,
        });
      } else if (
        msg &&
        msg.type === "STALE_REJECT" &&
        Array.isArray(msg.rejections)
      ) {
        // Server-side stale-write rejection (Last-Writer-Wins arbitration).
        // Surfaced so the user can see when peer broadcasts lose the race.
        for (const rej of msg.rejections) {
          if (typeof rej.slot === "number") {
            useHudStore.getState().setNet({
              lastRejectSlot: rej.slot,
              lastRejectReason: "stale lwwTimestamp",
              lastRejectAt: Date.now(),
              lastHelloAt: Date.now(),
              connected: true,
            });
            useHudStore.getState().pushEvent({
              type: "LWW_REJECT",
              slot: rej.slot,
              detail: "stale lwwTimestamp",
            });
          }
        }
      } else if (msg && msg.type === "PEER_COUNT" && typeof msg.count === "number") {
        // Heartbeat semantics
        useHudStore.getState().setNet({
          peerCount: msg.count,
          lastHelloAt: Date.now(),
          connected: true,
        });
      }
    } catch (err) {
      console.warn("[RCMT] Malformed control frame:", raw, err);
    }
  }
}

export const NetworkManager = new NetworkManagerClass();
