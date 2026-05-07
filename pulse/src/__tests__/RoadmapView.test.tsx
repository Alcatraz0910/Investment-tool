/**
 * UI-03: computeRoadmap pure-function tests.
 * Stubs — implementations added in plan 06-03.
 */
import { describe, it } from 'vitest'
// Import will be validated once roadmap.ts exists (plan 06-03)
// import { computeRoadmap } from '@/lib/plan/roadmap'

describe('computeRoadmap (UI-03)', () => {
  it.todo('returns [] when blend is null')
  it.todo('returns [] when blend.unified is empty')
  it.todo('returns monthly points from today through 5 April of tax year end')
  it.todo('produces at least 1 point when tax year has remaining months')
  it.todo('divergence: 0% Tech current vs 60% Tech blend → currentPath !== creatorVision after month 0')
  it.todo('all arithmetic uses Decimal internally; output values are plain numbers')
  it.todo('month labels formatted as "Mon YY" (e.g. "May 26")')
})
