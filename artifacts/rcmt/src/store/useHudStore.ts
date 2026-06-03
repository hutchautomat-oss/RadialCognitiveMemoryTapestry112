/**
 * useHudStore — Aerospace telemetry surface state.
 *
 * Holds:
 *   - Bounded event ring (`events`) used by the EVENT STREAM card.
 *   - Live camera readout (position / fov / target) pushed from inside the
 *     R3F canvas via the HudBridge component.
 *   - Live FPS sample (~4 Hz).
 *   - Network telemetry (peer id, peer count, last HELLO age, lww rejects).
 *   - Five invariant signals + their detail lines.
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
  | "DEMOTE"
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
  | "foveation";

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
  /** Manual run state — toggled ONLY by the user via `/pause` `/resume`. */
  running: boolean;
  periodMs: number;
  jitterMs: number;
  totalFired: number;
  lastFireAt: number;
  busy: boolean;
  /**
   * Idle auto-pause, driven by tab visibility (Page Visibility API), NOT by
   * the user. Layered on top of `running` so the two compose: the ticker fires
   * only when `running && !autoPaused`. A manual pause therefore stays paused
   * even after the tab returns, and auto-pause never clobbers the user's choice.
   */
  autoPaused: boolean;
}

const EVENT_RING_CAP = 500;
let eventSeq = 0;

const PERIPHERAL_FLASH_CAP = 16;
const PERIPHERAL_FLASH_TTL_MS = 1200;
let flashSeq = 0;

/**
 * HUD presentation mode. `aerospace` is the dense EFIS default for power
 * users; `guided` layers plain-English titles + help popovers on top of the
 * exact same cards. Mode never touches telemetry — it's pure chrome.
 */
export type HudMode = "aerospace" | "guided";

const HUD_MODE_KEY = "rcmt:hud:mode:v1";

function loadHudMode(): { mode: HudMode; hasPreference: boolean } {
  if (typeof window === "undefined") return { mode: "aerospace", hasPreference: false };
  try {
    const raw = window.localStorage.getItem(HUD_MODE_KEY);
    if (raw === "guided" || raw === "aerospace") return { mode: raw, hasPreference: true };
  } catch {
    // Private-mode / quota failures: fall back to the default, no preference.
  }
  return { mode: "aerospace", hasPreference: false };
}

function saveHudMode(mode: HudMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HUD_MODE_KEY, mode);
  } catch {
    // Non-fatal — the toggle still works for the current session.
  }
}

/** True once the user has made (or been assigned) an explicit mode choice. */
export function hudModePreferenceExists(): boolean {
  return loadHudMode().hasPreference;
}

const initialHudMode = loadHudMode();

/**
 * Structural-lattice (GhostScaffold) visibility. Pure render-side chrome — the
 * 8,000 rest positions drawn as a foveal point cloud before/under live nodes.
 * `off` hides it entirely (no draw call); `subtle` is the default look;
 * `full` brightens + slightly enlarges it for evaluators who want the capacity
 * envelope to read strongly. Never touches the lattice data or the wire format.
 */
export type ScaffoldIntensity = "off" | "subtle" | "full";

const SCAFFOLD_KEY = "rcmt:hud:scaffold:v1";

function loadScaffoldIntensity(): ScaffoldIntensity {
  if (typeof window === "undefined") return "subtle";
  try {
    const raw = window.localStorage.getItem(SCAFFOLD_KEY);
    if (raw === "off" || raw === "subtle" || raw === "full") return raw;
  } catch {
    // Private-mode / quota failures: fall back to the default.
  }
  return "subtle";
}

function saveScaffoldIntensity(v: ScaffoldIntensity) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SCAFFOLD_KEY, v);
  } catch {
    // Non-fatal — the control still works for the current session.
  }
}

const initialScaffoldIntensity = loadScaffoldIntensity();

/**
 * Camera navigation mode (split from the old orbit/fly toggle).
 *
 * - `work` (default): the cursor is a PURE POINTER — it hovers, selects, and
 *   opens the per-intersection console, but NEVER drives the camera. Cursor-
 *   targeted dolly (zoomToCursor) is structurally disabled here, so a stray
 *   scroll while you aim can't fling the view. Gentle, centred orbit + zoom
 *   that can't strand you outside the lattice.
 * - `drive`: a distortion-free scale dive. Constant FOV (no dolly-zoom), dolly
 *   always heads toward the core target so you can plunge into the dense Fact
 *   core or pan-and-dive out to the farthest rim cell — without ever exiting
 *   the sphere or stalling in empty space.
 *
 * Pure navigation chrome — never touches lattice data or the wire format.
 */
export type CameraMode = "work" | "drive";

const CAMERA_MODE_KEY = "rcmt:hud:camera:v1";

function loadCameraMode(): CameraMode {
  if (typeof window === "undefined") return "work";
  try {
    const raw = window.localStorage.getItem(CAMERA_MODE_KEY);
    if (raw === "work" || raw === "drive") return raw;
    // Migrate the pre-split persisted values so a returning user keeps intent:
    // orbit (cursor-centric inspection) → work; fly (piloting) → drive.
    if (raw === "orbit") return "work";
    if (raw === "fly") return "drive";
  } catch {
    // Private-mode / quota failures: fall back to the default.
  }
  return "work";
}

function saveCameraMode(v: CameraMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CAMERA_MODE_KEY, v);
  } catch {
    // Non-fatal — the control still works for the current session.
  }
}

const initialCameraMode = loadCameraMode();

export type FlashEdge = "top" | "bottom" | "left" | "right";

/** A peripheral-motion marker: a fading bar pinned to a viewport edge in the
 *  direction of a node a remote peer just mutated. */
export interface PeripheralFlash {
  id: number;
  edge: FlashEdge;
  /** 0..1 position along the edge (top→bottom for vertical, left→right for horizontal). */
  pos: number;
  color: string;
  at: number;
}

interface HudStore {
  events: HudEvent[];
  pushEvent: (e: Omit<HudEvent, "id" | "ts"> & { ts?: number }) => void;
  clearEvents: () => void;

  peripheralFlashes: PeripheralFlash[];
  pushPeripheralFlash: (f: Omit<PeripheralFlash, "id" | "at">) => void;

  camera: CameraReadout | null;
  setCamera: (c: CameraReadout) => void;

  fps: number;
  setFps: (n: number) => void;

  drawCalls: number;
  instancedCount: number;
  bvhMs: number;
  setRendererStats: (drawCalls: number, instancedCount: number) => void;
  setBvhMs: (ms: number) => void;

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
  setTickerAutoPaused: (autoPaused: boolean) => void;
  markTickerFired: () => void;

  /**
   * Cumulative count of every NEW memory ever admitted into the lattice
   * (spawn + axiom). Unlike the live tier occupancy this NEVER decreases —
   * it is the input-stream size used by the bloat-contrast readout to compute
   * what an unbounded vector store *would* have grown to. RCMT's own footprint
   * stays pinned at 8,000 slots / ~224 KB regardless.
   */
  totalInjected: number;
  incInjected: (n?: number) => void;

  hudMode: HudMode;
  setHudMode: (mode: HudMode) => void;
  onboardingOpen: boolean;
  setOnboardingOpen: (open: boolean) => void;

  scaffoldIntensity: ScaffoldIntensity;
  setScaffoldIntensity: (v: ScaffoldIntensity) => void;

  cameraMode: CameraMode;
  setCameraMode: (v: CameraMode) => void;

  /**
   * Surgical "dive to this cell" bridge from the console (work mode) into a
   * drive-mode scale dive. `requestDive` switches the camera to drive and
   * stamps a target world position + a monotonic epoch; an in-canvas
   * controller eases the OrbitControls target/distance toward it once per
   * epoch, then releases control. Camera-only — never touches lattice data.
   */
  diveRequest: { x: number; y: number; z: number; epoch: number } | null;
  requestDive: (pos: { x: number; y: number; z: number }) => void;
  /** Slot currently opened in the CellView overlay (full-panel). Null = closed. */
  cellViewSlot: number | null;
  setCellViewSlot: (slot: number | null) => void;
  /** Accessibility: reduce motion disables certain UI animation easing. */
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
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

  peripheralFlashes: [],
  pushPeripheralFlash: (f) =>
    set((s) => {
      const now = Date.now();
      // Prune anything past its fade window, then append + cap.
      const kept = s.peripheralFlashes.filter((p) => now - p.at < PERIPHERAL_FLASH_TTL_MS);
      kept.push({ ...f, id: ++flashSeq, at: now });
      const trimmed =
        kept.length > PERIPHERAL_FLASH_CAP
          ? kept.slice(kept.length - PERIPHERAL_FLASH_CAP)
          : kept;
      return { peripheralFlashes: trimmed };
    }),

  camera: null,
  setCamera: (c) => set({ camera: c }),

  fps: 0,
  setFps: (n) => set({ fps: n }),

  drawCalls: 0,
  instancedCount: 0,
  bvhMs: 0,
  setRendererStats: (drawCalls, instancedCount) =>
    set({ drawCalls, instancedCount }),
  setBvhMs: (ms) => set({ bvhMs: ms }),

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
    autoPaused: false,
  },
  setTickerRunning: (running) =>
    set((s) => ({ ticker: { ...s.ticker, running } })),
  setTickerPeriod: (ms) =>
    set((s) => ({ ticker: { ...s.ticker, periodMs: Math.max(250, ms | 0) } })),
  setTickerBusy: (busy) =>
    set((s) => ({ ticker: { ...s.ticker, busy } })),
  setTickerAutoPaused: (autoPaused) =>
    set((s) => ({ ticker: { ...s.ticker, autoPaused } })),
  markTickerFired: () =>
    set((s) => ({
      ticker: {
        ...s.ticker,
        totalFired: s.ticker.totalFired + 1,
        lastFireAt: Date.now(),
      },
    })),

  totalInjected: 0,
  incInjected: (n = 1) => set((s) => ({ totalInjected: s.totalInjected + n })),

  hudMode: initialHudMode.mode,
  setHudMode: (mode) => {
    saveHudMode(mode);
    set({ hudMode: mode });
  },
  // Auto-open the onboarding overlay only when the user has never made a
  // mode choice (no localStorage key). A returning user goes straight to
  // their saved mode; `/tour` re-opens the overlay on demand.
  onboardingOpen: !initialHudMode.hasPreference,
  setOnboardingOpen: (open) => set({ onboardingOpen: open }),

  scaffoldIntensity: initialScaffoldIntensity,
  setScaffoldIntensity: (v) => {
    saveScaffoldIntensity(v);
    set({ scaffoldIntensity: v });
  },

  cameraMode: initialCameraMode,
  setCameraMode: (v) => {
    saveCameraMode(v);
    set({ cameraMode: v });
  },

  diveRequest: null,
  requestDive: (pos) =>
    set((s) => {
      saveCameraMode("drive");
      return {
        cameraMode: "drive",
        diveRequest: {
          x: pos.x,
          y: pos.y,
          z: pos.z,
          epoch: (s.diveRequest?.epoch ?? 0) + 1,
        },
      };
    }),
  /** Slot currently opened in the CellView overlay (full-panel). Null = closed. */
  cellViewSlot: null,
  setCellViewSlot: (slot) => set({ cellViewSlot: slot }),
  reducedMotion: false,
  setReducedMotion: (v) => set({ reducedMotion: v }),
}));

/** Module-level shortcut so non-React modules can push events without subscribing. */
export function pushHudEvent(
  e: Omit<HudEvent, "id" | "ts"> & { ts?: number },
): void {
  useHudStore.getState().pushEvent(e);
}
