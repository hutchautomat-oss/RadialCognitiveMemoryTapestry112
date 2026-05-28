/**
 * useHudStore — Aerospace telemetry surface state.
 *
 * Holds:
 *   - Bounded event ring (`events`) used by the EVENT STREAM card.
 *   - Live camera readout (position / fov / target) pushed from inside the
 *     R3F canvas via the HudBridge component.
 *   - Live FPS sample (~4 Hz).
 *   - Network telemetry (peer id, peer count, last HELLO age, lww rejects).
 *   - Six invariant signals + their detail lines.
 *   - Thought ticker state (running, period_ms, last fire timestamp, total
 *     fired, currently busy bool, paused-by-user).
 *
 * Deliberately decoupled from `useSaccadeStore` — both stores import
 * `pushHudEvent` here, but this store imports nothing from the lattice. That
 * keeps the dependency graph acyclic so HMR doesn't double-init either store.
 */

import { create } from "zustand";

export type HudEventType =
  | "SPAWN"
  | "REINFORCE"
  | "PROMOTE"
  | "EVICT"
  | "LWW_REJECT"
  | "LOW_CONF"
  | "INVARIANT_FAIL"
  | "AXIOM"
  | "INFO"
  | "PAUSE"
  | "RESUME"
  | "ERROR";

export interface HudEvent {
  id: number;
  ts: number;
  type: HudEventType;
  slot?: number;
  tier?: number;
  phrase?: string;
  detail?: string;
}

export interface CameraReadout {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
  fov: number;
  distance: number;
}

export type InvariantId =
  | "stride"
  | "tier_contiguity"
  | "fifo"
  | "bvh_proxy"
  | "foveation"
  | "parity";

export interface InvariantState {
  ok: boolean;
  detail: string;
  lastChange: number;
}

export interface NetTelemetry {
  connected: boolean;
  peerId: number;
  peerCount: number;
  packetsIn: number;
  packetsOut: number;
  packetsInRate: number;
  packetsOutRate: number;
  lastHelloAt: number;
  lastRejectSlot: number | null;
  lastRejectReason: string | null;
  lastRejectAt: number;
}

export interface TickerState {
  running: boolean;
  periodMs: number;
  jitterMs: number;
  totalFired: number;
  lastFireAt: number;
  busy: boolean;
}

const EVENT_RING_CAP = 500;
let eventSeq = 0;

interface HudStore {
  events: HudEvent[];
  pushEvent: (e: Omit<HudEvent, "id" | "ts"> & { ts?: number }) => void;
  clearEvents: () => void;

  camera: CameraReadout | null;
  setCamera: (c: CameraReadout) => void;

  fps: number;
  setFps: (n: number) => void;

  drawCalls: number;
  instancedCount: number;
  setRendererStats: (drawCalls: number, instancedCount: number) => void;

  net: NetTelemetry;
  setNet: (patch: Partial<NetTelemetry>) => void;
  incPacketsIn: (n?: number) => void;
  incPacketsOut: (n?: number) => void;

  invariants: Record<InvariantId, InvariantState>;
  setInvariant: (id: InvariantId, ok: boolean, detail: string) => void;

  ticker: TickerState;
  setTickerRunning: (running: boolean) => void;
  setTickerPeriod: (ms: number) => void;
  setTickerBusy: (busy: boolean) => void;
  markTickerFired: () => void;
}

const emptyInvariant = (): InvariantState => ({
  ok: true,
  detail: "uninitialized",
  lastChange: 0,
});

export const useHudStore = create<HudStore>((set, get) => ({
  events: [],
  pushEvent: (e) => {
    const id = ++eventSeq;
    const ts = e.ts ?? Date.now();
    set((s) => {
      const next = s.events.length >= EVENT_RING_CAP
        ? s.events.slice(s.events.length - EVENT_RING_CAP + 1)
        : s.events.slice();
      next.push({ id, ts, ...e });
      return { events: next };
    });
  },
  clearEvents: () => set({ events: [] }),

  camera: null,
  setCamera: (c) => set({ camera: c }),

  fps: 0,
  setFps: (n) => set({ fps: n }),

  drawCalls: 0,
  instancedCount: 0,
  setRendererStats: (drawCalls, instancedCount) =>
    set({ drawCalls, instancedCount }),

  net: {
    connected: false,
    peerId: -1,
    peerCount: 0,
    packetsIn: 0,
    packetsOut: 0,
    packetsInRate: 0,
    packetsOutRate: 0,
    lastHelloAt: 0,
    lastRejectSlot: null,
    lastRejectReason: null,
    lastRejectAt: 0,
  },
  setNet: (patch) => set((s) => ({ net: { ...s.net, ...patch } })),
  incPacketsIn: (n = 1) => set((s) => ({ net: { ...s.net, packetsIn: s.net.packetsIn + n } })),
  incPacketsOut: (n = 1) => set((s) => ({ net: { ...s.net, packetsOut: s.net.packetsOut + n } })),

  invariants: {
    stride: emptyInvariant(),
    tier_contiguity: emptyInvariant(),
    fifo: emptyInvariant(),
    bvh_proxy: emptyInvariant(),
    foveation: emptyInvariant(),
    parity: emptyInvariant(),
  },
  setInvariant: (id, ok, detail) => {
    const prev = get().invariants[id];
    if (prev.ok === ok && prev.detail === detail) return;
    set((s) => ({
      invariants: {
        ...s.invariants,
        [id]: { ok, detail, lastChange: Date.now() },
      },
    }));
    // Only push INVARIANT_FAIL when transitioning to red, not on every sample.
    if (!ok && prev.ok) {
      get().pushEvent({
        type: "INVARIANT_FAIL",
        detail: `${id}: ${detail}`,
      });
    }
  },

  ticker: {
    running: true,
    periodMs: 3000,
    jitterMs: 1000,
    totalFired: 0,
    lastFireAt: 0,
    busy: false,
  },
  setTickerRunning: (running) =>
    set((s) => ({ ticker: { ...s.ticker, running } })),
  setTickerPeriod: (ms) =>
    set((s) => ({ ticker: { ...s.ticker, periodMs: Math.max(250, ms | 0) } })),
  setTickerBusy: (busy) =>
    set((s) => ({ ticker: { ...s.ticker, busy } })),
  markTickerFired: () =>
    set((s) => ({
      ticker: {
        ...s.ticker,
        totalFired: s.ticker.totalFired + 1,
        lastFireAt: Date.now(),
      },
    })),
}));

/** Module-level shortcut so non-React modules can push events without subscribing. */
export function pushHudEvent(
  e: Omit<HudEvent, "id" | "ts"> & { ts?: number },
): void {
  useHudStore.getState().pushEvent(e);
}
