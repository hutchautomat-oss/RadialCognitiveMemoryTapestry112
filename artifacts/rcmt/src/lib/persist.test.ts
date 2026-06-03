/**
 * persist.test.ts - sovereign_save_key.bin round-trip invariants.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as persist from "./tapestryPersist";
import {
  useSaccadeStore,
  MAX_NODES,
  STRIDE,
  TIER_CAPS,
  TIER_STARTS,
} from "../store/useSaccadeStore";

const _lsStore: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => _lsStore[k] ?? null,
  setItem: (k: string, v: string) => { _lsStore[k] = v; },
  removeItem: (k: string) => { delete _lsStore[k]; },
  clear: () => { for (const k in _lsStore) delete _lsStore[k]; },
});

function resetStore() {
  const fresh = new Float32Array(MAX_NODES * STRIDE);
  const vacantSlotsByTier = TIER_CAPS.map((cap, t) => {
    const start = TIER_STARTS[t];
    const out = new Array<number>(cap);
    for (let i = 0; i < cap; i++) out[i] = start + i;
    return out;
  });
  const s = useSaccadeStore.getState();
  s.mass.fill(0);
  s.injectedAt.fill(0);
  s.spawnTime.fill(0);
  s.reinforcementCount.fill(0);
  s.animStartTime.fill(0);
  s.embeddings.fill(0);
  useSaccadeStore.setState({
    mockFrames: [fresh],
    totalFrames: 1,
    activeFrameIndex: 0,
    isFileLoaded: false,
    vacantSlotsByTier,
    tierCounts: TIER_CAPS.map(() => 0),
    slotPhrase: new Array(MAX_NODES).fill(null),
    bvhDirty: true,
  });
}

describe("sovereign_save_key.bin round-trip", () => {
  beforeEach(resetStore);

  it("encode -> decode -> re-encode produces byte-identical output", async () => {
    persist.autosaveToLocalStorage();
    const r1 = persist.bootLoadFromLocalStorage();
    expect(r1).not.toBeNull();
    expect(r1!.ok).toBe(true);
    expect(r1!.slotCount).toBe(0);

    persist.autosaveToLocalStorage();
    const raw1 = localStorage.getItem("rcmt_sovereign_save_key")!;
    persist.bootLoadFromLocalStorage();
    persist.autosaveToLocalStorage();
    const raw2 = localStorage.getItem("rcmt_sovereign_save_key")!;

    function b64ToBytes(b64: string): Uint8Array {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    }
    const b1 = b64ToBytes(raw1);
    const b2 = b64ToBytes(raw2);
    for (let i = 0; i < 12; i++) expect(b1[i]).toBe(b2[i]);
    for (let i = 20; i < b1.length; i++) expect(b1[i]).toBe(b2[i]);
  });

  it("restores slotPhrase[] after round-trip", async () => {
    const s = useSaccadeStore.getState();
    const outcome = s.injectLiveIntentVector({
      slot: 1, textLength: 20,
      colorRGB: [0.15, 0.95, 0.89],
      phrase: "sovereign grounding substrate",
    });
    expect(outcome).not.toBeNull();
    const slot = outcome!.index;
    persist.autosaveToLocalStorage();
    resetStore();
    expect(useSaccadeStore.getState().slotPhrase[slot]).toBeNull();
    const r = persist.bootLoadFromLocalStorage();
    expect(r!.ok).toBe(true);
    expect(useSaccadeStore.getState().slotPhrase[slot]).toBe("sovereign grounding substrate");
  });

  it("slotCount correct after round-trip", async () => {
    const s = useSaccadeStore.getState();
    s.injectLiveIntentVector({ slot: 1, textLength: 5, colorRGB: [0.15, 0.95, 0.89], phrase: "a" });
    s.injectLiveIntentVector({ slot: 3, textLength: 5, colorRGB: [0.87, 0.8, 0.29],  phrase: "b" });
    s.injectLiveIntentVector({ slot: 5, textLength: 5, colorRGB: [0.73, 0.46, 0.78], phrase: "c" });
    persist.autosaveToLocalStorage();
    resetStore();
    const r = persist.bootLoadFromLocalStorage();
    expect(r!.ok).toBe(true);
    expect(r!.slotCount).toBe(3);
  });

  it("version mismatch rejected loudly", async () => {
    persist.autosaveToLocalStorage();
    const raw = localStorage.getItem("rcmt_sovereign_save_key")!;
    const bin = atob(raw);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    arr[4] = 0; arr[5] = 99;
    let c = ""; for (let i = 0; i < arr.length; i++) c += String.fromCharCode(arr[i]);
    localStorage.setItem("rcmt_sovereign_save_key", btoa(c));
    const r = persist.bootLoadFromLocalStorage();
    expect(r!.ok).toBe(false);
    expect(r!.message).toMatch(/unsupported save version 99/);
  });

  it("magic mismatch rejected loudly", async () => {
    persist.autosaveToLocalStorage();
    const raw = localStorage.getItem("rcmt_sovereign_save_key")!;
    const bin = atob(raw);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    arr[0] = 0xde; arr[1] = 0xad; arr[2] = 0xbe; arr[3] = 0xef;
    let c = ""; for (let i = 0; i < arr.length; i++) c += String.fromCharCode(arr[i]);
    localStorage.setItem("rcmt_sovereign_save_key", btoa(c));
    const r = persist.bootLoadFromLocalStorage();
    expect(r!.ok).toBe(false);
    expect(r!.message).toMatch(/bad magic/);
  });

  it("returns null when no save exists", async () => {
    localStorage.clear();
    expect(persist.bootLoadFromLocalStorage()).toBeNull();
  });

  it("frame buffer positions preserved after round-trip", async () => {
    const s = useSaccadeStore.getState();
    const outcome = s.injectLiveIntentVector({
      slot: 2, textLength: 10,
      colorRGB: [0.37, 0.9, 0.2],
      phrase: "scenario node",
    });
    const slot = outcome!.index;
    const frameBefore = new Float32Array(s.mockFrames[0]);
    persist.autosaveToLocalStorage();
    resetStore();
    const r = persist.bootLoadFromLocalStorage();
    expect(r!.ok).toBe(true);
    const frameAfter = useSaccadeStore.getState().mockFrames[0];
    const off = slot * STRIDE;
    expect(frameAfter[off + 0]).toBeCloseTo(frameBefore[off + 0], 5);
    expect(frameAfter[off + 1]).toBeCloseTo(frameBefore[off + 1], 5);
    expect(frameAfter[off + 2]).toBeCloseTo(frameBefore[off + 2], 5);
    expect(frameAfter[off + 6]).toBeCloseTo(frameBefore[off + 6], 5);
  });
});
