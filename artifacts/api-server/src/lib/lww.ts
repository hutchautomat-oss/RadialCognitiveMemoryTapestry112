/**
 * CRVM packet decoding + Last-Writer-Wins arbitration.
 *
 * Extracted from `src/index.ts` so the byte-layout and arbitration logic can
 * be exercised without booting an HTTP server or a WebSocket harness. The
 * runtime server imports the same functions — there is no second copy of the
 * protocol. Any change here is a change to the wire format and should be
 * accompanied by a test in `lww.test.ts`.
 */

/** Hard cap mirrored from the client lattice (`useSaccadeStore.MAX_NODES`). */
export const MAX_NODES = 8000;

/**
 * Bytes per node packet on the wire. This is the "28-byte stride" the rest of
 * the codebase refers to. Layout:
 *   Bytes  0- 1: nodeIndex / slotIndex   (Uint16LE)
 *   Bytes  2- 3: intentId               (Uint16LE, 0=unknown, 1=Fact..5=Dream)
 *   Bytes  4- 7: x                      (Float32LE)
 *   Bytes  8-11: y                      (Float32LE)
 *   Bytes 12-15: z                      (Float32LE)
 *   Bytes 16-19: mass/scale             (Float32LE)
 *   Bytes 20-27: lwwTimestamp           (Float64LE, ms since epoch)
 *
 * NOTE: peerId is NOT carried in this packet — the server assigns a peerId
 * over the JSON HELLO frame and prevents self-echoes structurally. Any
 * "upgraded" composite-clock or writer-ID-hash framing would break tests
 * pinned to this stride; see `lww.test.ts`.
 */
export const STRIDE_BYTES = 28;

/** Allocate a fresh per-server LWW timestamp map. */
export function makeTimestampMap(maxNodes: number = MAX_NODES): Float64Array {
  return new Float64Array(maxNodes).fill(0.0);
}

/**
 * Decode a single packet at offset `offset` and return `{ nodeIndex, timestamp }`.
 * Cheap helper for tests; the hot path in `processPacketBatch` inlines the
 * `readUInt16LE` / `readDoubleLE` calls.
 */
export function readPacketHeader(
  buf: Buffer,
  offset: number,
): { nodeIndex: number; timestamp: number } {
  return {
    nodeIndex: buf.readUInt16LE(offset),
    timestamp: buf.readDoubleLE(offset + 20),
  };
}

/**
 * Apply LWW arbitration over a concatenated buffer of N×28-byte packets.
 *
 * Behavior (pinned by `lww.test.ts`):
 * - Packets whose byte length is not a multiple of STRIDE_BYTES are rejected
 *   wholesale (return `null` broadcast).
 * - For each packet, if `timestamp > timestampMap[nodeIndex]`, the packet is
 *   accepted and the map is updated. Equal timestamps are dropped (the
 *   strictly-greater comparison is the source of truth for tie-breaking).
 * - Packets whose `nodeIndex >= maxNodes` are silently skipped.
 * - Returns the rebroadcast buffer (only the accepted packets, in their
 *   original order) or `null` if nothing should be rebroadcast.
 *
 * This function does NOT mutate the input buffer. It does mutate the
 * `timestampMap` in place — that is the LWW arbitration state.
 */
export function processPacketBatch(
  data: Buffer,
  timestampMap: Float64Array,
  maxNodes: number = MAX_NODES,
): { accepted: number[]; broadcast: Buffer | null } {
  if (!Buffer.isBuffer(data)) return { accepted: [], broadcast: null };
  if (data.byteLength === 0) return { accepted: [], broadcast: null };
  if (data.byteLength % STRIDE_BYTES !== 0) {
    return { accepted: [], broadcast: null };
  }

  const packetCount = data.byteLength / STRIDE_BYTES;
  const accepted: number[] = [];

  for (let i = 0; i < packetCount; i++) {
    const offset = i * STRIDE_BYTES;
    const nodeIndex = data.readUInt16LE(offset);
    const timestamp = data.readDoubleLE(offset + 20);

    if (nodeIndex >= maxNodes) continue;
    if (timestamp > timestampMap[nodeIndex]) {
      timestampMap[nodeIndex] = timestamp;
      accepted.push(i);
    }
  }

  if (accepted.length === 0) return { accepted, broadcast: null };

  const broadcast = Buffer.allocUnsafe(accepted.length * STRIDE_BYTES);
  accepted.forEach((srcIdx, dstIdx) => {
    data.copy(
      broadcast,
      dstIdx * STRIDE_BYTES,
      srcIdx * STRIDE_BYTES,
      (srcIdx + 1) * STRIDE_BYTES,
    );
  });

  return { accepted, broadcast };
}
