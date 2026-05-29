# Why 28 bytes?

The CRVM (Cognitive Realtime VRAM Mutation) packet is the unit of replication between RCMT peers. Exactly 28 bytes, laid out as:

| Offset | Size | Field         | Notes                                  |
|--------|------|---------------|----------------------------------------|
| 0      | 2    | nodeIndex     | Uint16LE, 0..7999                      |
| 2      | 2    | intentId      | Uint16LE, 0=unknown, 1=Fact .. 5=Dream |
| 4      | 4    | x             | Float32LE                              |
| 8      | 4    | y             | Float32LE                              |
| 12     | 4    | z             | Float32LE                              |
| 16     | 4    | mass / scale  | Float32LE                              |
| 20     | 8    | lwwTimestamp  | Float64LE (ms since epoch)             |

This shape is **not** an accident and **not** negotiable. Four properties depend on it:

1. **224 KB total wire footprint.** 8,000 slots × 28 bytes. Small enough that a frontier-lab evaluator can `wget` your grounded memory state. A 32-byte packet (e.g. + a u32 peerId) would push that to 256 KB and break the round-number math we cite to evaluators.
2. **No embedded peerId.** The server assigns a peerId over a JSON HELLO frame on connect, then physically excludes the sender from each broadcast. Putting peerId on every packet is wire bloat and an identity coupling the protocol deliberately avoids — the server arbitrates, the packets stay anonymous.
3. **No composite clock.** The 8-byte timestamp is a plain Float64, not split into "48-bit physical + 16-bit peer-ID tiebreaker." The server is the single arbiter, so a vector clock buys nothing.
4. **Single arbitration rule: strictly-greater wins.** Equal timestamps drop. Any tie-breaker beyond strict-greater would require re-examining replay semantics.

All four of these are pinned by tripwires in `artifacts/api-server/src/lib/lww.test.ts`. A NotebookLM paste cannot quietly "upgrade" the wire format without breaking CI; that is the design.

Equally important: **no text, no embedding, no model state lives in the packet**. That is what makes the lattice byte-stable across model upgrades — re-running the classifier with a newer MiniLM does not move any slot, because the slot's position is `√(slotIndex) · 0.6` along the golden-angle spiral and nothing else.

See also: [`why-local-only.md`](./why-local-only.md), [`why-foveation.md`](./why-foveation.md).
