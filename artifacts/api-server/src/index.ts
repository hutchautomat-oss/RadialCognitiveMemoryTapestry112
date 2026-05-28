import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

// ============================================================
// RCMT Sync Core — LWW Binary Protocol (CRVM stride)
// 28-byte stride per node:
//   Bytes  0- 1: nodeIndex / slotIndex   (Uint16LE)
//   Bytes  2- 3: intentId  (Uint16LE, 0=unknown, 1=Fact..5=Dream)
//   Bytes  4- 7: x         (Float32LE)
//   Bytes  8-11: y         (Float32LE)
//   Bytes 12-15: z         (Float32LE)
//   Bytes 16-19: mass/scale (Float32LE)
//   Bytes 20-27: lwwTimestamp (Float64LE, ms since epoch)
//
// peerId is NO LONGER carried in the per-node packet. Instead, the server
// assigns a peerId on connect and sends it as a JSON "HELLO" text frame.
// Self-echoes are physically prevented by the `client !== ws` broadcast
// filter below — the redundant client-side peerId check has been removed.
// ============================================================
const MAX_NODES = 8000;
const STRIDE_BYTES = 28;
const indexTimestampMap = new Float64Array(MAX_NODES).fill(0.0);

const wss = new WebSocketServer({ server, path: "/socket" });

wss.on("connection", (ws) => {
  const peerId = Math.floor(Math.random() * 100000);
  logger.info({ peerId }, "RCMT peer connected");

  // HELLO handshake — assign peerId to this connection. Client uses it
  // for logging/debug only; LWW + echo prevention live server-side now.
  try {
    ws.send(JSON.stringify({ type: "HELLO", peerId, stride: STRIDE_BYTES }));
  } catch (err) {
    logger.error({ err, peerId }, "RCMT HELLO send failed");
  }

  ws.on("message", (data) => {
    if (!Buffer.isBuffer(data)) return;
    if (data.byteLength % STRIDE_BYTES !== 0) return;

    const packetCount = data.byteLength / STRIDE_BYTES;
    const accepted: number[] = [];

    for (let i = 0; i < packetCount; i++) {
      const offset = i * STRIDE_BYTES;
      const nodeIndex = data.readUInt16LE(offset);
      const timestamp = data.readDoubleLE(offset + 20);

      if (nodeIndex >= MAX_NODES) continue;
      // LWW: only forward if timestamp is newer than what we've seen
      if (timestamp > indexTimestampMap[nodeIndex]) {
        indexTimestampMap[nodeIndex] = timestamp;
        accepted.push(i);
      }
    }

    if (accepted.length === 0) return;

    const broadcast = Buffer.allocUnsafe(accepted.length * STRIDE_BYTES);
    accepted.forEach((srcIdx, dstIdx) => {
      data.copy(
        broadcast,
        dstIdx * STRIDE_BYTES,
        srcIdx * STRIDE_BYTES,
        (srcIdx + 1) * STRIDE_BYTES,
      );
    });

    // Self-echo prevention: sender excluded from broadcast.
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(broadcast);
      }
    });
  });

  ws.on("close", () => logger.info({ peerId }, "RCMT peer disconnected"));
  ws.on("error", (err) => logger.error({ err, peerId }, "RCMT WS error"));
});

server.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "RCMT server + sync core listening");
});
