export const UPDATE_BYTES = 33;
export const CLAIM_BYTES = 13;

const _outboundUpdateQueue: ArrayBuffer[] = [];

export function enqueueUpdate(buf: ArrayBuffer) {
  _outboundUpdateQueue.push(buf);
}

export function drainOutboundUpdates(): ArrayBuffer[] {
  const out = _outboundUpdateQueue.slice();
  _outboundUpdateQueue.length = 0;
  return out;
}

/**
 * Build a 33-byte Vector Update packet (OpCode 0x01):
 * [0]    uint8  opcode = 0x01
 * [1..4] uint32 targetIndex (LE)
 * [5..32] seven float32 values (LE): X,Y,Z,R,G,B,Scale
 */
export function buildUpdatePacket(
  index: number,
  x: number,
  y: number,
  z: number,
  r: number,
  g: number,
  b: number,
  scale: number,
): ArrayBuffer {
  const buf = new ArrayBuffer(UPDATE_BYTES);
  const view = new DataView(buf);
  view.setUint8(0, 0x01);
  view.setUint32(1, index >>> 0, true);
  view.setFloat32(5, x, true);
  view.setFloat32(9, y, true);
  view.setFloat32(13, z, true);
  view.setFloat32(17, r, true);
  view.setFloat32(21, g, true);
  view.setFloat32(25, b, true);
  view.setFloat32(29, scale, true);
  return buf;
}

/**
 * Build a 13-byte Index Claim packet (OpCode 0x02):
 * [0]    uint8  opcode = 0x02
 * [1..4] uint32 targetIndex (LE)
 * [5..12] uint64 CompositeClock (LE) = (timestampMillis << 16) | (writerId & 0xffff)
 */
export function buildClaimPacket(index: number, writerId: number): ArrayBuffer {
  const buf = new ArrayBuffer(CLAIM_BYTES);
  const view = new DataView(buf);
  view.setUint8(0, 0x02);
  view.setUint32(1, index >>> 0, true);
  const ts = BigInt(Date.now());
  const w = BigInt(writerId & 0xffff);
  const composite = (ts << 16n) | w;
  // DataView exposes setBigUint64 in modern environments; guard for older runtimes.
  if (typeof view.setBigUint64 === "function") {
    (view as DataView).setBigUint64(5, composite, true);
  } else {
    // Polyfill by splitting into two Uint32 for environments without BigInt support.
    const lo = Number(composite & 0xffffffffn) >>> 0;
    const hi = Number((composite >> 32n) & 0xffffffffn) >>> 0;
    view.setUint32(5, lo, true);
    view.setUint32(9, hi, true);
  }
  return buf;
}
