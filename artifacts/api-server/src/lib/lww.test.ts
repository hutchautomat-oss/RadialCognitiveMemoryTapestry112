/**
 * CRVM wire-format + LWW arbitration invariants.
 *
 * These tests pin the byte layout and arbitration policy that the rest of
 * the system depends on. The CRVM server must preserve the single 28-byte
 * node packet and reject stale writes without introducing a composite clock
 * or split claim/update handshake.
 */

import { describe, it, expect } from "vitest";
import { MAX_NODES, STRIDE_BYTES, makeTimestampMap, processPacketBatch, readPacketHeader } from "./lww";

function makeRenderStridePacket(opts: {
  nodeIndex: number;
  intentId?: number;
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  timestamp: number;
}): Buffer {
  const buf = Buffer.alloc(STRIDE_BYTES);
  buf.writeUInt16LE(opts.nodeIndex, 0);
  buf.writeUInt16LE(opts.intentId ?? 0, 2);
  buf.writeFloatLE(opts.x ?? 0, 4);
  buf.writeFloatLE(opts.y ?? 0, 8);
  buf.writeFloatLE(opts.z ?? 0, 12);
  buf.writeFloatLE(opts.scale ?? 1, 16);
  buf.writeDoubleLE(opts.timestamp, 20);
  return buf;
}

describe("CRVM wire-format", () => {
  it("a single renderer stride packet is exactly 28 bytes", () => {
    expect(STRIDE_BYTES).toBe(28);
    expect(makeRenderStridePacket({ nodeIndex: 0, timestamp: 1 }).byteLength).toBe(28);
  });

  it("nodeIndex is u16LE at offset 0 and lwwTimestamp is f64LE at offset 20", () => {
    const p = makeRenderStridePacket({ nodeIndex: 1234, timestamp: 1_700_000_000_123.5 });
    const header = readPacketHeader(p, 0);
    expect(header.nodeIndex).toBe(1234);
    expect(header.timestamp).toBeCloseTo(1_700_000_000_123.5, 10);
  });
});

describe("CRVM LWW arbitration", () => {
  it("accepts a newer timestamp and broadcasts the 28-byte packet", () => {
    const timestampMap = makeTimestampMap();
    const packet = makeRenderStridePacket({ nodeIndex: 42, timestamp: 12345678 });

    const result = processPacketBatch(packet, timestampMap);

    expect(result.updateBroadcasts).toHaveLength(1);
    expect(result.privateRejects).toHaveLength(0);
    expect(timestampMap[42]).toBeCloseTo(12345678);

    const accepted = result.updateBroadcasts[0];
    expect(accepted.byteLength).toBe(STRIDE_BYTES);
    expect(accepted.readUInt16LE(0)).toBe(42);
  });

  it("rejects stale timestamps and returns a private LWW_REJECT payload", () => {
    const timestampMap = makeTimestampMap();
    timestampMap[5] = 1000;
    const stalePacket = makeRenderStridePacket({ nodeIndex: 5, timestamp: 999 });

    const result = processPacketBatch(stalePacket, timestampMap);

    expect(result.updateBroadcasts).toHaveLength(0);
    expect(result.privateRejects).toHaveLength(1);
    expect(result.privateRejects[0]).toEqual({
      slot: 5,
      reason: "stale lwwTimestamp",
    });
  });

  it("ignores out-of-range node indexes while still processing valid packets", () => {
    const timestampMap = makeTimestampMap();
    const validPacket = makeRenderStridePacket({ nodeIndex: 1, timestamp: 1 });
    const invalidPacket = makeRenderStridePacket({ nodeIndex: MAX_NODES + 1, timestamp: 1 });
    const buffer = Buffer.concat([validPacket, invalidPacket]);

    const result = processPacketBatch(buffer, timestampMap);

    expect(result.updateBroadcasts).toHaveLength(1);
    expect(result.privateRejects).toHaveLength(0);
    expect(timestampMap[1]).toBeCloseTo(1);
  });
});
