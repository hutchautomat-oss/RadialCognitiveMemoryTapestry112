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
// Master buffer strategy:
//   - Pre-allocate 224,000 bytes (8000 nodes × 28 bytes/node)
//   - Track authoritative timestamps in a separate Float64Array
//   - On client HELLO, send the full master buffer for perfect sync
//   - On incoming packet, check timestamp against authoritative; if newer,
//     update master buffer and broadcast to swarm; if stale, reject
// ============================================================

const MAX_NODES = 8000;
const STRIDE_BYTES = 28;
const MASTER_BUFFER_SIZE = MAX_NODES * STRIDE_BYTES; // 224,000 bytes

// Zero-copy master buffer and Float64 timestamp registry
const masterBuffer = new Uint8Array(MASTER_BUFFER_SIZE);
const indexTimestampMap = new Float64Array(MAX_NODES).fill(0.0);

const wss = new WebSocketServer({ server, path: "/socket" });

function broadcastPeerCount() {
  const count = wss.clients.size;
  const frame = JSON.stringify({ type: "PEER_COUNT", count });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(frame);
  });
}

wss.on("connection", (ws) => {
  const peerId = Math.floor(Math.random() * 100000);
  logger.info({ peerId }, "RCMT peer connected");

  // HELLO Initializer: Send peerId + full state to new client
  try {
    ws.send(JSON.stringify({ type: "HELLO", peerId }));
    ws.send(masterBuffer.buffer);
  } catch (err) {
    logger.error({ err, peerId }, "RCMT HELLO send failed");
  }
  broadcastPeerCount();

  ws.on("message", (data) => {
    if (!Buffer.isBuffer(data)) return;

    // Ensure strictly 28-byte atomic packets
    if (data.byteLength % STRIDE_BYTES !== 0) return;

    let offset = 0;
    const rejections: Array<{ slot: number; authoritativeTimestamp: number }> = [];

    while (offset < data.byteLength) {
      const nodeIndex = data.readUInt16LE(offset);

      if (nodeIndex >= MAX_NODES) {
        offset += STRIDE_BYTES;
        continue;
      }

      // Extract 64-bit LWW Timestamp from offset 20 (unaligned but safe in Node.js)
      const incomingTimestamp = data.readDoubleLE(offset + 20);

      // Server-Side LWW Arbitration
      if (incomingTimestamp > indexTimestampMap[nodeIndex]) {
        // Update authoritative timestamp and master buffer
        indexTimestampMap[nodeIndex] = incomingTimestamp;
        masterBuffer.set(data.subarray(offset, offset + STRIDE_BYTES), nodeIndex * STRIDE_BYTES);

        // Broadcast the 28-byte binary frame to all other peers
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(data.subarray(offset, offset + STRIDE_BYTES));
          }
        });
      } else {
        // Reject stale writes with a control frame
        rejections.push({
          slot: nodeIndex,
          authoritativeTimestamp: indexTimestampMap[nodeIndex],
        });
      }

      offset += STRIDE_BYTES;
    }

    // Send all rejections in a single control frame
    if (rejections.length > 0 && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "STALE_REJECT",
        rejections,
      }));
    }
  });

  ws.on("close", () => {
    logger.info({ peerId }, "RCMT peer disconnected");
    broadcastPeerCount();
  });
  ws.on("error", (err) => logger.error({ err, peerId }, "RCMT WS error"));
});

server.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "RCMT server + sync core listening");
});
