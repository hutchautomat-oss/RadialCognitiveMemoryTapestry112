/**
 * tapestryPersist — sovereign_save_key.bin read/write.
 *
 * Persists the live lattice (mockFrames[0]) to localStorage so the tapestry
 * survives a page refresh. Also exposes /save (download) and /load (file
 * upload) for hand-rolled exports that a downstream consumer can wget.
 *
 * Wire format is UNCHANGED (28-byte CRVM packet). This is a DISK format only.
 *
 * Binary layout of sovereign_save_key.bin:
 *   [0..3]   magic   u32  = 0x52434D54  ("RCMT")
 *   [4..5]   version u16  = 1
 *   [6..7]   maxNodes u16 = 8000
 *   [8..9]   stride  u16 = 7  (Float32 stride per node in the frame buffer)
 *   [10..11] tierCount u16 = 5
 *   [12..19] savedAt  f64  = Date.now() at save time
 *   [20..23] phraseBlockBytes u32 = byte length of the UTF-8 phrase block
 *   [24..28223] frame Float32Array (MAX_NODES * STRIDE * 4 bytes = 224000 bytes)
 *   [28224..28224+phraseBlockBytes-1]  UTF-8 phrase block
 *     Layout: for each slot 0..MAX_NODES-1, one length-prefixed UTF-8 string:
 *       u16 byteLen (0 = vacant/no phrase)
 *       [byteLen bytes of UTF-8]
 *
 * Total minimum size: 28224 bytes (no phrases). Max ~12 MB (all 8k slots with
 * long phrases). Embeddings are NOT serialized — recomputed lazily on next
 * reinforcement pass (saves ~12 MB; see sovereign-save-key.md open questions).
 *
 * Protection boundary: this is open engine (Bucket 1). The frame buffer and
 * phrase array are runtime state, not calibration. Calibration constants
 * never touch this file.
 */

import {
    useSaccadeStore,
    MAX_NODES,
    STRIDE,
    TIER_CAPS,
    TIER_STARTS,
} from "../store/useSaccadeStore";

// ── Constants ──────────────────────────────────────────────────────────
const MAGIC = 0x52434d54; // "RCMT"
const VERSION = 1;
const HEADER_BYTES = 24; // magic(4)+version(2)+maxNodes(2)+stride(2)+tierCount(2)+savedAt(8)+phraseBlockBytes(4)
const FRAME_BYTES = MAX_NODES * STRIDE * 4; // 8000*7*4 = 224000
const LS_KEY = "rcmt_sovereign_save_key";

// Debounce handle for the auto-save timer.
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTOSAVE_DEBOUNCE_MS = 30_000;

// ── Encode ─────────────────────────────────────────────────────────────

function encodePhraseBlock(phrases: (string | null)[]): Uint8Array {
    const enc = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (let i = 0; i < MAX_NODES; i++) {
          const p = phrases[i];
          if (!p) {
                  chunks.push(new Uint8Array(2)); // u16 len = 0
            total += 2;
          } else {
                  const utf8 = enc.encode(p);
                  const lenBuf = new Uint8Array(2);
                  new DataView(lenBuf.buffer).setUint16(0, Math.min(utf8.byteLength, 0xffff), false);
                  chunks.push(lenBuf);
                  chunks.push(utf8);
                  total += 2 + utf8.byteLength;
          }
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
          out.set(c, off);
          off += c.byteLength;
    }
    return out;
}

function encodeTapestry(): ArrayBuffer {
    const s = useSaccadeStore.getState();
    const frame = s.mockFrames[0];
    if (!frame) throw new Error("no live frame to save");

  const phraseBlock = encodePhraseBlock(s.slotPhrase);
    const totalBytes = HEADER_BYTES + FRAME_BYTES + phraseBlock.byteLength;
    const buf = new ArrayBuffer(totalBytes);
    const dv = new DataView(buf);
    let off = 0;

  dv.setUint32(off, MAGIC, false);          off += 4;
    dv.setUint16(off, VERSION, false);        off += 2;
    dv.setUint16(off, MAX_NODES, false);      off += 2;
    dv.setUint16(off, STRIDE, false);         off += 2;
    dv.setUint16(off, TIER_CAPS.length, false); off += 2;
    dv.setFloat64(off, Date.now(), false);    off += 8;
    dv.setUint32(off, phraseBlock.byteLength, false); off += 4;

  // Frame buffer
  const frameBytes = new Uint8Array(frame.buffer, frame.byteOffset, FRAME_BYTES);
    new Uint8Array(buf, off, FRAME_BYTES).set(frameBytes);
    off += FRAME_BYTES;

  // Phrase block
  new Uint8Array(buf, off).set(phraseBlock);

  return buf;
}

// ── Decode ─────────────────────────────────────────────────────────────

export interface LoadResult {
    ok: boolean;
    message: string;
    savedAt?: number;
    slotCount?: number;
}

function decodeTapestry(buf: ArrayBuffer): LoadResult {
    if (buf.byteLength < HEADER_BYTES + FRAME_BYTES) {
          return { ok: false, message: "file too small — not a valid sovereign save" };
    }
    const dv = new DataView(buf);
    let off = 0;

  const magic = dv.getUint32(off, false); off += 4;
    if (magic !== MAGIC) {
          return { ok: false, message: `bad magic 0x${magic.toString(16)} — expected 0x52434d54` };
    }
    const version = dv.getUint16(off, false); off += 2;
    if (version !== VERSION) {
          return { ok: false, message: `unsupported save version ${version} (expected ${VERSION}) — refusing to load` };
    }
    const savedMaxNodes = dv.getUint16(off, false); off += 2;
    const savedStride   = dv.getUint16(off, false); off += 2;
    const savedTierCount = dv.getUint16(off, false); off += 2;
    if (savedMaxNodes !== MAX_NODES || savedStride !== STRIDE || savedTierCount !== TIER_CAPS.length) {
          return {
                  ok: false,
                  message: `shape mismatch: file has ${savedMaxNodes} nodes / stride ${savedStride} / ${savedTierCount} tiers; runtime expects ${MAX_NODES}/${STRIDE}/${TIER_CAPS.length}`,
          };
    }
    const savedAt = dv.getFloat64(off, false); off += 8;
    const phraseBlockBytes = dv.getUint32(off, false); off += 4;

  if (buf.byteLength < HEADER_BYTES + FRAME_BYTES + phraseBlockBytes) {
        return { ok: false, message: "file truncated — phrase block extends past EOF" };
  }

  // Restore frame buffer
  const newFrame = new Float32Array(MAX_NODES * STRIDE);
    new Uint8Array(newFrame.buffer).set(new Uint8Array(buf, off, FRAME_BYTES));
    off += FRAME_BYTES;

  // Restore phrase block
  const dec = new TextDecoder();
    const newPhrases: (string | null)[] = new Array(MAX_NODES).fill(null);
    const phraseView = new DataView(buf, off, phraseBlockBytes);
    let pOff = 0;
    for (let i = 0; i < MAX_NODES && pOff + 2 <= phraseBlockBytes; i++) {
          const len = phraseView.getUint16(pOff, false); pOff += 2;
          if (len === 0) continue;
          if (pOff + len > phraseBlockBytes) break;
          newPhrases[i] = dec.decode(new Uint8Array(buf, off + pOff, len));
          pOff += len;
    }

  // Rebuild per-slot bookkeeping from the restored frame
  const newVacantByTier: number[][] = TIER_CAPS.map(() => []);
    const newTierCounts = TIER_CAPS.map(() => 0);
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const s = useSaccadeStore.getState();

  // Zero out runtime arrays before re-populating
  s.mass.fill(0);
    s.injectedAt.fill(0);
    s.spawnTime.fill(0);
    s.reinforcementCount.fill(0);
    s.animStartTime.fill(0);
    s.embeddings.fill(0);

  let slotCount = 0;
    for (let i = 0; i < MAX_NODES; i++) {
          const scale = newFrame[i * STRIDE + 6];
          // Determine which tier this slot belongs to by absolute index range.
      let tier = -1;
          for (let t = 0; t < TIER_CAPS.length; t++) {
                  if (i >= TIER_STARTS[t] && i < TIER_STARTS[t] + TIER_CAPS[t]) {
                            tier = t;
                            break;
                  }
          }
          if (tier < 0) continue;

      if (scale > 0) {
              s.mass[i] = scale;
              s.injectedAt[i] = now; // reset to "now" — decay restarts from a fresh baseline
            s.spawnTime[i] = now;
              newTierCounts[tier]++;
              slotCount++;
      } else {
              newVacantByTier[tier].push(i);
      }
    }

  useSaccadeStore.setState({
        mockFrames: [newFrame],
        activeFrameIndex: 0,
        totalFrames: 1,
        isFileLoaded: false,
        vacantSlotsByTier: newVacantByTier,
        tierCounts: newTierCounts,
        slotPhrase: newPhrases,
        bvhDirty: true,
  });

  return { ok: true, message: `loaded ${slotCount} slots from save`, savedAt, slotCount };
}

// ── localStorage auto-save / boot-load ────────────────────────────────

/** Encode and write the current tapestry to localStorage. Silent on quota errors. */
export function autosaveToLocalStorage(): void {
    try {
          const buf = encodeTapestry();
          // Base64-encode because localStorage only holds strings.
      const bytes = new Uint8Array(buf);
          let bin = "";
          for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
          localStorage.setItem(LS_KEY, btoa(bin));
    } catch {
          // Quota exceeded or encode error — fail silently (best-effort persistence).
    }
}

/** Schedule an autosave 30 s from now, debounced. Call on every lattice mutation. */
export function scheduleAutosave(): void {
    if (_saveTimer !== null) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
          _saveTimer = null;
          autosaveToLocalStorage();
    }, AUTOSAVE_DEBOUNCE_MS);
}

/** Flush any pending debounced save immediately (call from beforeunload). */
export function flushAutosave(): void {
    if (_saveTimer !== null) {
          clearTimeout(_saveTimer);
          _saveTimer = null;
    }
    autosaveToLocalStorage();
}

/**
 * Attempt to restore the tapestry from localStorage on boot.
 * Returns a human-readable result string for the console log.
 * No-op (returns null) if no save exists.
 */
export function bootLoadFromLocalStorage(): LoadResult | null {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    try {
          const bin = atob(raw);
          const buf = new ArrayBuffer(bin.length);
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return decodeTapestry(buf);
    } catch (e) {
          return { ok: false, message: `boot-load parse error: ${(e as Error).message}` };
    }
}

// ── /save command — download a .bin file ──────────────────────────────

/** Trigger a browser download of the current tapestry as sovereign_save_key.bin */
export function downloadTapestry(): void {
    const buf = encodeTapestry();
    const blob = new Blob([buf], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sovereign_save_key.bin";
    a.click();
    URL.revokeObjectURL(url);
}

// ── /load command — load a .bin file from disk ────────────────────────

/**
 * Load a sovereign_save_key.bin from a File object (from an <input type="file">
 * or drag-and-drop). Returns a LoadResult for the console to display.
 */
export function loadTapestryFromFile(file: File): Promise<LoadResult> {
    return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
                  const buf = e.target?.result;
                  if (!(buf instanceof ArrayBuffer)) {
                            resolve({ ok: false, message: "FileReader did not return an ArrayBuffer" });
                            return;
                  }
                  resolve(decodeTapestry(buf));
          };
          reader.onerror = () =>
                  resolve({ ok: false, message: "FileReader error reading file" });
          reader.readAsArrayBuffer(file);
    });
}
