/**
 * CRVM wire-format + LWW arbitration invariants.
 *
 * These tests pin the byte layout and arbitration policy that the rest of
 * the system depends on. If a NotebookLM paste reintroduces a composite
 * clock, a writer-ID hash, or an embedded peerId, one of these tests will
 * fail loudly and force a real decision before the protocol drifts.
 */

import { describe, it, expect } from "vitest";
import {
  STRIDE_BYTES,
  MAX_NODES,
  makeTimestampMap,
  processPacketBatch,
  readPacketHeader,
} from "./lww";

function makePacket(opts: {
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
  it("a single packet is exactly 28 bytes", () => {
    expect(STRIDE_BYTES).toBe(28);
    expect(makePacket({ nodeIndex: 0, timestamp: 1 }).byteLength).toBe(28);
  });

  it("nodeIndex is u16LE at offset 0 and lwwTimestamp is f64LE at offset 20", () => {
    const p = makePacket({ nodeIndex: 1234, timestamp: 1_700_000_000_123.5 });
    const header = readPacketHeader(p, 0);
    expect(header.nodeIndex).toBe(1234);
    expect(header.timestamp).toBeCloseTo(1_700_000_000_123.5, 10);
  });

  it("tripwire: packet has NO embedded peerId / composite-clock field", () => {
    // The protocol is intentionally 28 bytes flat. Any "upgrade" that
    // appends a writer-ID hash or splits the timestamp into a composite
    // clock would change the stride. Pin it.
    expect(STRIDE_BYTES).toBe(28);
    // A 32-byte stride (e.g. + u32 peerId) would fail this:
    const batch = Buffer.concat([
      makePacket({ nodeIndex: 0, timestamp: 1 }),
      makePacket({ nodeIndex: 1, timestamp: 1 }),
    ]);
    expect(batch.byteLength).toBe(2 * 28);
    // And confirm processPacketBatch flatly rejects a buffer that is not a
    // multiple of STRIDE_BYTES — which is what we'd see on day-1 of a wire
    // upgrade if the client/server got out of sync.
    const bad = Buffer.concat([batch, Buffer.from([0xff, 0xff])]);
    const { broadcast, accepted } = processPacketBatch(
      bad,
      makeTimestampMap(),
    );
    expect(broadcast).toBeNull();
    expect(accepted).toHaveLength(0);
  });
});

describe("LWW arbitration", () => {
  it("the packet with the larger timestamp wins for the same nodeIndex", () => {
    const map = makeTimestampMap();
    const first = makePacket({ nodeIndex: 7, timestamp: 100 });
    const second = makePacket({ nodeIndex: 7, timestamp: 200 });

    const r1 = processPacketBatch(first, map);
    expect(r1.accepted).toEqual([0]);
    expect(map[7]).toBe(100);

    const r2 = processPacketBatch(second, map);
    expect(r2.accepted).toEqual([0]);
    expect(map[7]).toBe(200);
  });

  it("equal timestamps are dropped (strictly-greater is the tiebreaker)", () => {
    const map = makeTimestampMap();
    processPacketBatch(makePacket({ nodeIndex: 3, timestamp: 50 }), map);
    const dup = processPacketBatch(
      makePacket({ nodeIndex: 3, timestamp: 50 }),
      map,
    );
    expect(dup.broadcast).toBeNull();
    expect(dup.accepted).toHaveLength(0);
  });

  it("stale packets are filtered out of the rebroadcast buffer", () => {
    const map = makeTimestampMap();
    // Establish current state at t=500.
    processPacketBatch(makePacket({ nodeIndex: 9, timestamp: 500 }), map);
    // Batch of three: one stale, one fresh-different-node, one stale-equal.
    const batch = Buffer.concat([
      makePacket({ nodeIndex: 9, timestamp: 100 }), // stale → dropped
      makePacket({ nodeIndex: 10, timestamp: 600 }), // accepted
      makePacket({ nodeIndex: 9, timestamp: 500 }), // equal → dropped
    ]);
    const { accepted, broadcast } = processPacketBatch(batch, map);
    expect(accepted).toEqual([1]);
    expect(broadcast).not.toBeNull();
    expect(broadcast!.byteLength).toBe(STRIDE_BYTES);
    // The lone accepted packet's header reads back as nodeIndex=10, t=600.
    const header = readPacketHeader(broadcast!, 0);
    expect(header.nodeIndex).toBe(10);
    expect(header.timestamp).toBe(600);
  });

  it("nodeIndex >= MAX_NODES is silently skipped", () => {
    const map = makeTimestampMap();
    const oob = makePacket({ nodeIndex: MAX_NODES, timestamp: 1_000 });
    const { accepted, broadcast } = processPacketBatch(oob, map);
    expect(accepted).toHaveLength(0);
    expect(broadcast).toBeNull();
  });
});
