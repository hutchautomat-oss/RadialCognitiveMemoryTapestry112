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
// RCMT Sync Core — LWW Binary Protocol
// 28-byte stride per node:
//   Bytes  0- 1: nodeIndex  (Uint16LE)
//   Bytes  2- 3: peerId     (Uint16LE)
//   Bytes  4- 7: x          (Float32LE)
//   Bytes  8-11: y          (Float32LE)
//   Bytes 12-15: z          (Float32LE)
//   Bytes 16-19: certainty  (Float32LE)
//   Bytes 20-27: timestamp  (Float64LE)
// ============================================================
const MAX_NODES = 8000;
const STRIDE_BYTES = 28;
const indexTimestampMap = new Float64Array(MAX_NODES).fill(0.0);

const wss = new WebSocketServer({ server, path: "/socket" });

wss.on("connection", (ws) => {
  const peerId = Math.floor(Math.random() * 100000);
  logger.info({ peerId }, "RCMT peer connected");

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
