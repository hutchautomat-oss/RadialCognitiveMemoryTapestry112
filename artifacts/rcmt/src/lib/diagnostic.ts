export type HamiltonianPoint = {
  timestamp: number
  H: number
  K: number
  V: number
}

export type HealthDecayPoint = {
  deltaT: number
  actual: number
  baseline: number
  tier: number
}

export type StrikeSlot = {
  slot: number
  strikes: number
  score: number
}

export type GeodesicNode = {
  x: number
  y: number
  tier: number
  mass: number
}

export type FrameTimeSample = {
  frame: number
  dt: number
  gcSpike: boolean
}

export const FRAME_TIME_TARGET_MS = 16.67
export const MAX_NODES = 8000
export const DREAM_ALERT_PERCENT = 60

export function computeHealthBaseline(lambda: number, deltaT: number): number {
  return Math.exp(-lambda * deltaT)
}

export function getDreamOccupancyPercent(tierCounts: number[]): number {
  const dreamCount = tierCounts[4] ?? 0
  return (dreamCount / MAX_NODES) * 100
}

export function isDreamOvercapacity(tierCounts: number[]): boolean {
  return getDreamOccupancyPercent(tierCounts) > DREAM_ALERT_PERCENT
}

export function getTierDistribution(tierCounts: number[]) {
  const total = tierCounts.reduce((sum, value) => sum + value, 0)
  return {
    counts: tierCounts,
    total,
    dreamPercent: getDreamOccupancyPercent(tierCounts),
    overcapacity: isDreamOvercapacity(tierCounts),
  }
}

export function getFrameTimeStats(samples: FrameTimeSample[]) {
  const count = samples.length
  const total = samples.reduce((sum, sample) => sum + sample.dt, 0)
  const max = count === 0 ? 0 : Math.max(...samples.map((s) => s.dt))
  const average = count === 0 ? 0 : total / count
  const spikes = samples.filter((sample) => sample.gcSpike || sample.dt > FRAME_TIME_TARGET_MS * 2)
  return {
    count,
    average,
    max,
    spikes,
    alert: spikes.length > 0 || max > FRAME_TIME_TARGET_MS * 1.2,
  }
}

export function getStrikeThresholdAlert(strikes: StrikeSlot[], threshold = 3) {
  const nearPromotion = strikes.filter((slot) => slot.strikes >= threshold - 1)
  return {
    total: strikes.length,
    nearPromotionCount: nearPromotion.length,
    nearPromotion,
  }
}

export function getHealthDecayError(samples: HealthDecayPoint[]) {
  const errors = samples.map((point) => Math.abs(point.actual - point.baseline))
  const averageError = errors.length === 0 ? 0 : errors.reduce((sum, x) => sum + x, 0) / errors.length
  return {
    averageError,
    maxError: errors.length === 0 ? 0 : Math.max(...errors),
  }
}

export function recentHamiltonianWindow(points: HamiltonianPoint[], windowMs = 10000) {
  const now = points.length ? points[points.length - 1].timestamp : Date.now()
  return points.filter((point) => now - point.timestamp <= windowMs)
}
