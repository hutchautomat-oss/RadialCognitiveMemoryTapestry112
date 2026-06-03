import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { ChartContainer, ChartLegend, ChartTooltip } from "./ui/chart";
import {
  FRAME_TIME_TARGET_MS,
  GeodesicNode,
  HamiltonianPoint,
  HealthDecayPoint,
  StrikeSlot,
  FrameTimeSample,
  getDreamOccupancyPercent,
  getFrameTimeStats,
  getHealthDecayError,
  getStrikeThresholdAlert,
  recentHamiltonianWindow,
} from "@/lib/diagnostic";

export interface DiagnosticPanelProps {
  energySeries: HamiltonianPoint[];
  tierCounts: number[];
  healthDecaySeries: HealthDecayPoint[];
  strikeDistribution: StrikeSlot[];
  geodesicNodes: GeodesicNode[];
  frameTimes: FrameTimeSample[];
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function frameTimeColor(dt: number) {
  if (dt > FRAME_TIME_TARGET_MS * 2) return "text-red-400";
  if (dt > FRAME_TIME_TARGET_MS * 1.2) return "text-amber-300";
  return "text-emerald-400";
}

export function DiagnosticPanel({
  energySeries,
  tierCounts,
  healthDecaySeries,
  strikeDistribution,
  geodesicNodes,
  frameTimes,
}: DiagnosticPanelProps) {
  const history = recentHamiltonianWindow(energySeries, 10000);
  const dreamPercent = getDreamOccupancyPercent(tierCounts);
  const frameStats = getFrameTimeStats(frameTimes);
  const strikeAlert = getStrikeThresholdAlert(strikeDistribution);
  const healthError = getHealthDecayError(healthDecaySeries);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="grid gap-4">
        <div className="rounded-3xl border border-border/50 bg-background/80 p-4 shadow-xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Hamiltonian Trajectory</h2>
              <p className="text-xs text-muted-foreground">10s rolling trace of H, K, and V</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-400">
              {history.length} points
            </span>
          </div>
          <ChartContainer id="hamiltonian" className="h-52" config={{ H: { label: "H_total", color: "#f97316" }, K: { label: "Kinetic", color: "#34d399" }, V: { label: "Potential", color: "#38bdf8" } }}>
            <RechartsPrimitive.LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <RechartsPrimitive.XAxis dataKey="timestamp" hide />
              <RechartsPrimitive.YAxis width={36} tick={{ fill: "#cbd5e1" }} />
              <ChartTooltip wrapperStyle={{ outline: "none" }} />
              <ChartLegend verticalAlign="top" />
              <RechartsPrimitive.Line type="monotone" dataKey="H" stroke="#f97316" dot={false} strokeWidth={2} />
              <RechartsPrimitive.Line type="monotone" dataKey="K" stroke="#34d399" dot={false} strokeWidth={2} />
              <RechartsPrimitive.Line type="monotone" dataKey="V" stroke="#38bdf8" dot={false} strokeWidth={2} />
            </RechartsPrimitive.LineChart>
          </ChartContainer>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-border/50 bg-background/80 p-4 shadow-xl">
            <div className="mb-3">
              <h2 className="text-sm font-semibold">Tier Occupancy Pie</h2>
              <p className="text-xs text-muted-foreground">Alerts if Dreams exceed 60%</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="h-40">
                <ChartContainer id="tier-pie" className="h-full" config={{ Fact: { color: "#f59e0b" }, Scenario: { color: "#2dd4bf" }, Metric: { color: "#38bdf8" }, Theory: { color: "#fb7185" }, Dream: { color: "#a855f7" } }}>
                  <RechartsPrimitive.PieChart>
                    <RechartsPrimitive.Pie
                      data={[
                        { name: "Fact", value: tierCounts[0] ?? 0 },
                        { name: "Scenario", value: tierCounts[1] ?? 0 },
                        { name: "Metric", value: tierCounts[2] ?? 0 },
                        { name: "Theory", value: tierCounts[3] ?? 0 },
                        { name: "Dream", value: tierCounts[4] ?? 0 },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={28}
                      outerRadius={60}
                      fill="#6366f1"
                    />
                    <ChartTooltip wrapperStyle={{ outline: "none" }} />
                  </RechartsPrimitive.PieChart>
                </ChartContainer>
              </div>
              <div className="flex flex-col justify-center gap-2 text-sm">
                <div className="text-muted-foreground">Dream occupancy</div>
                <div className={dreamPercent > 60 ? "text-red-400" : "text-emerald-400"}>
                  {formatPercent(dreamPercent)}
                </div>
                <div className="rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
                  {dreamPercent > 60
                    ? "CRITICAL: Dream tier exceeds the Visual Crowding Knot threshold."
                    : "System capacity within safe Dream occupancy limits."}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/50 bg-background/80 p-4 shadow-xl">
            <div className="mb-3">
              <h2 className="text-sm font-semibold">Health Decay Histogram</h2>
              <p className="text-xs text-muted-foreground">Actual vs theoretical cooling baseline</p>
            </div>
            <ChartContainer id="health-decay" className="h-52" config={{ actual: { label: "Actual Health", color: "#38bdf8" }, baseline: { label: "Theoretical", color: "#f97316" } }}>
              <RechartsPrimitive.ComposedChart data={healthDecaySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <RechartsPrimitive.XAxis dataKey="deltaT" tick={{ fill: "#cbd5e1" }} />
                <RechartsPrimitive.YAxis width={36} tick={{ fill: "#cbd5e1" }} domain={[0, 1]} />
                <ChartTooltip wrapperStyle={{ outline: "none" }} />
                <ChartLegend verticalAlign="top" />
                <RechartsPrimitive.Bar dataKey="actual" barSize={8} fill="#38bdf8" />
                <RechartsPrimitive.Line type="monotone" dataKey="baseline" stroke="#f97316" dot={false} strokeWidth={2} />
              </RechartsPrimitive.ComposedChart>
            </ChartContainer>
            <div className="mt-3 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
              Average deviation: {healthError.averageError.toFixed(3)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-3xl border border-border/50 bg-background/80 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Strike Distribution</h2>
              <p className="text-xs text-muted-foreground">Slots at or near the promotion threshold</p>
            </div>
            <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-sky-300">
              {strikeAlert.nearPromotionCount} near threshold
            </span>
          </div>
          <ChartContainer id="strike-dist" className="h-52" config={{ strikes: { label: "Strikes", color: "#f97316" } }}>
            <RechartsPrimitive.BarChart data={strikeDistribution.slice(0, 12)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <RechartsPrimitive.XAxis dataKey="slot" tick={{ fill: "#cbd5e1" }} />
              <RechartsPrimitive.YAxis width={36} tick={{ fill: "#cbd5e1" }} />
              <ChartTooltip wrapperStyle={{ outline: "none" }} />
              <RechartsPrimitive.Bar dataKey="strikes" fill="#f97316" />
            </RechartsPrimitive.BarChart>
          </ChartContainer>
          <div className="mt-3 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
            {strikeAlert.nearPromotionCount > 0
              ? `${strikeAlert.nearPromotionCount} slots are within one strike of promotion.`
              : "No immediate promotion candidates."}
          </div>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/80 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Geodesic Spatial Projection</h2>
              <p className="text-xs text-muted-foreground">2D scatter with foveation contours</p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-300">
              {geodesicNodes.length} nodes
            </span>
          </div>
          <ChartContainer id="geodesic" className="h-52" config={{ tier: { label: "Tier", color: "#38bdf8" } }}>
            <RechartsPrimitive.ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <RechartsPrimitive.XAxis dataKey="x" tick={{ fill: "#cbd5e1" }} />
              <RechartsPrimitive.YAxis dataKey="y" tick={{ fill: "#cbd5e1" }} />
              <ChartTooltip wrapperStyle={{ outline: "none" }} />
              <RechartsPrimitive.Scatter data={geodesicNodes} fill="#38bdf8" />
            </RechartsPrimitive.ScatterChart>
          </ChartContainer>
          <div className="mt-3 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
            The projection shows the 2D semantic manifold and foveated density gradient.
          </div>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/80 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Frame-Time Gauge</h2>
              <p className="text-xs text-muted-foreground">60-frame latency tracking + GC spike detection</p>
            </div>
            <span className={frameStats.alert ? "rounded-full bg-red-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-red-300" : "rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300"}>
              {frameStats.alert ? "ALERT" : "STABLE"}
            </span>
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div className="rounded-2xl bg-muted p-3">
                <div>Average</div>
                <div className="font-mono text-sm text-foreground">{frameStats.average.toFixed(2)} ms</div>
              </div>
              <div className="rounded-2xl bg-muted p-3">
                <div>Max</div>
                <div className="font-mono text-sm text-foreground">{frameStats.max.toFixed(2)} ms</div>
              </div>
              <div className="rounded-2xl bg-muted p-3">
                <div>Spikes</div>
                <div className="font-mono text-sm text-foreground">{frameStats.spikes.length}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
              {frameTimes.slice(-3).map((sample) => (
                <div key={sample.frame} className="rounded-2xl bg-slate-950/10 p-3">
                  <div className="text-muted-foreground">Frame {sample.frame}</div>
                  <div className={frameTimeColor(sample.dt) + " font-mono text-sm text-foreground"}>{sample.dt.toFixed(2)} ms</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
