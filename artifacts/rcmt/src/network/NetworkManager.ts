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
 * peerId is NOT in the packet — the server assigns it via a JSON HELLO
 * frame on connect, and the server itself excludes the sender from each
 * broadcast, so self-echoes are physically impossible.
 */

import { useStore } from "../store/useStore";
import { useHudStore } from "../store/useHudStore";

const STRIDE_BYTES = 28;
const RECONNECT_DELAY_MS = 3000;

class NetworkManagerClass {
  private socket: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // peerId assigned by the server on HELLO. -1 until the handshake completes.
  // Used only for logging/debug; never written into the packet.
  private peerId = -1;

  connect(): void {
    if (this.socket) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/socket`;

    try {
      this.socket = new WebSocket(url);
      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {
        this.connected = true;
        console.info("[RCMT] Sync core connected — awaiting HELLO");
      };

      this.socket.onmessage = (evt) => {
        // Text frames are control messages (HELLO); binary frames are CRVM packets.
        if (typeof evt.data === "string") {
          this.handleControl(evt.data);
          return;
        }
        if (evt.data instanceof ArrayBuffer) this.handleIncoming(evt.data);
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
   * Broadcast a node update. `intentId` defaults to 0 (unknown) for legacy
   * call sites (drag, position update). ONNX-injection broadcasts should
   * pass the classified slot (1..5) so remote peers can paint the correct
   * color without re-running inference.
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
    view.setUint16(0, index, true);
    view.setUint16(2, intentId & 0xffff, true);
    view.setFloat32(4, x, true);
    view.setFloat32(8, y, true);
    view.setFloat32(12, z, true);
    view.setFloat32(16, scale, true);
    view.setFloat64(20, Date.now(), true);

    try {
      this.socket.send(buf);
    } catch (err) {
      console.error("[RCMT] Send error", err);
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get assignedPeerId(): number {
    return this.peerId;
  }

  private handleControl(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      if (msg && msg.type === "HELLO" && typeof msg.peerId === "number") {
        this.peerId = msg.peerId;
        console.info("[RCMT] HELLO — assigned peer", this.peerId);
      }
    } catch (err) {
      console.warn("[RCMT] Malformed control frame:", raw, err);
    }
  }

  private handleIncoming(data: ArrayBuffer): void {
    const count = Math.floor(data.byteLength / STRIDE_BYTES);
    const view = new DataView(data);
    const updateNodePosition = useStore.getState().updateNodePosition;

    for (let i = 0; i < count; i++) {
      const offset = i * STRIDE_BYTES;
      const nodeIndex = view.getUint16(offset, true);
      // const intentId = view.getUint16(offset + 2, true); // reserved for color routing
      const x = view.getFloat32(offset + 4, true);
      const y = view.getFloat32(offset + 8, true);
      const z = view.getFloat32(offset + 12, true);

      updateNodePosition(nodeIndex, [x, y, z]);
    }
    if (count > 0) useHudStore.getState().incPacketsIn(count);
  }
}

export const NetworkManager = new NetworkManagerClass();
