import { describe, expect, it } from 'vitest'
import { immersiveDwellCounts, plazaImpressionItem } from './workExposure'

describe('immersive dwell', () => {
  it('counts only after 1000ms and rejects implausible long stays', () => {
    expect(immersiveDwellCounts(999)).toBe(false)
    expect(immersiveDwellCounts(1000)).toBe(true)
    expect(immersiveDwellCounts(12_000)).toBe(true)
    expect(immersiveDwellCounts(300_001)).toBe(false)
  })

  it('reports work id in the cardId field the impressions API already uses', () => {
    expect(plazaImpressionItem('wk-1', 2, 1200, 9)).toEqual({
      cardId: 'wk-1',
      pos: 2,
      dwellMs: 1200,
      ts: 9,
    })
  })
})
