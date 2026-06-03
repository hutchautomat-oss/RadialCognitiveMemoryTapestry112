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

/** The immutable visual stride used by the renderer and the 28-byte update payload. */
export const STRIDE_BYTES = 28;

export function makeTimestampMap(maxNodes: number = MAX_NODES): Float64Array {
  return new Float64Array(maxNodes).fill(0);
}

export function readPacketHeader(
  buf: Buffer,
  offset: number,
): { nodeIndex: number; timestamp: number } {
  return {
    nodeIndex: buf.readUInt16LE(offset),
    timestamp: buf.readDoubleLE(offset + 20),
  };
}

export function processPacketBatch(
  data: Buffer,
  timestampMap: Float64Array,
): {
  updateBroadcasts: Buffer[];
  privateRejects: Array<{ slot: number; reason: string }>;
} {
  const updateBroadcasts: Buffer[] = [];
  const privateRejects: Array<{ slot: number; reason: string }> = [];

  if (!Buffer.isBuffer(data) || data.byteLength === 0) {
    return { updateBroadcasts, privateRejects };
  }

  let offset = 0;
  while (offset + STRIDE_BYTES <= data.byteLength) {
    const nodeIndex = data.readUInt16LE(offset);
    const timestamp = data.readDoubleLE(offset + 20);

    if (nodeIndex >= timestampMap.length) {
      offset += STRIDE_BYTES;
      continue;
    }

    const currentTimestamp = timestampMap[nodeIndex];
    if (timestamp > currentTimestamp) {
      timestampMap[nodeIndex] = timestamp;
      updateBroadcasts.push(data.subarray(offset, offset + STRIDE_BYTES));
    } else {
      privateRejects.push({
        slot: nodeIndex,
        reason: "stale lwwTimestamp",
      });
    }

    offset += STRIDE_BYTES;
  }

  return { updateBroadcasts, privateRejects };
}
