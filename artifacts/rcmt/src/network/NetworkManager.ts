/**
 * RCMT NetworkManager — LWW WebSocket client
 *
 * Binary stride layout (28 bytes per node):
 *   Bytes  0- 1: nodeIndex  (Uint16LE)
 *   Bytes  2- 3: peerId     (Uint16LE)
 *   Bytes  4- 7: x          (Float32LE)
 *   Bytes  8-11: y          (Float32LE)
 *   Bytes 12-15: z          (Float32LE)
 *   Bytes 16-19: certainty  (Float32LE)
 *   Bytes 20-27: timestamp  (Float64LE)
 */

import { useStore } from "../store/useStore";

const STRIDE_BYTES = 28;
const RECONNECT_DELAY_MS = 3000;
const peerId = Math.floor(Math.random() * 65535);

class NetworkManagerClass {
  private socket: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(): void {
    if (this.socket) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/socket`;

    try {
      this.socket = new WebSocket(url);
      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {
        this.connected = true;
        console.info("[RCMT] Sync core connected — peer", peerId);
      };

      this.socket.onmessage = (evt) => {
        if (!(evt.data instanceof ArrayBuffer)) return;
        this.handleIncoming(evt.data);
      };

      this.socket.onclose = () => {
        this.connected = false;
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
  }

  broadcastNodeUpdate(
    index: number,
    x: number,
    y: number,
    z: number,
    certainty: number,
  ): void {
    if (!this.connected || !this.socket) return;

    const buf = new ArrayBuffer(STRIDE_BYTES);
    const view = new DataView(buf);
    view.setUint16(0, index, true);
    view.setUint16(2, peerId, true);
    view.setFloat32(4, x, true);
    view.setFloat32(8, y, true);
    view.setFloat32(12, z, true);
    view.setFloat32(16, certainty, true);
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

  private handleIncoming(data: ArrayBuffer): void {
    const count = Math.floor(data.byteLength / STRIDE_BYTES);
    const view = new DataView(data);
    const updateNodePosition = useStore.getState().updateNodePosition;

    for (let i = 0; i < count; i++) {
      const offset = i * STRIDE_BYTES;
      const nodeIndex = view.getUint16(offset, true);
      const incomingPeer = view.getUint16(offset + 2, true);
      if (incomingPeer === peerId) continue; // skip own echoes

      const x = view.getFloat32(offset + 4, true);
      const y = view.getFloat32(offset + 8, true);
      const z = view.getFloat32(offset + 12, true);

      updateNodePosition(nodeIndex, [x, y, z]);
    }
  }
}

export const NetworkManager = new NetworkManagerClass();
