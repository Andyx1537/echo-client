/** 全屏记 n：视口内连续驻留下限，与 SPEC-feed-surfaces / ExposureRecorder 一致。 */
export const IMMERSIVE_DWELL_MS = 1000
export const IMMERSIVE_DWELL_MAX_MS = 300_000

export function immersiveDwellCounts(elapsedMs: number): boolean {
  return elapsedMs >= IMMERSIVE_DWELL_MS && elapsedMs <= IMMERSIVE_DWELL_MAX_MS
}

export function plazaImpressionItem(workId: string, pos: number, dwellMs: number, ts: number) {
  return { cardId: workId, pos, dwellMs, ts }
}
