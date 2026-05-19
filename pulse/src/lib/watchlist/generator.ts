import { Decimal } from 'decimal.js'
import type { CreatorProfile } from '@/lib/strategy/extractor'

export interface WatchListItem {
  ticker: string
  name: string
  conviction: 'high' | 'medium' | 'low'
  layer: 'stable' | 'latest'
  rationale: string
}

export interface CreatorWatchList {
  creatorId: string
  creatorName: string
  monthlyBudgetGbp: number    // plain number for RSC→client serialization
  items: WatchListItem[]
  hasProfile: boolean         // false = never refreshed after Phase 11
}

const CONVICTION_ORDER = { high: 0, medium: 1, low: 2 } as const

export function buildWatchLists(
  creators: Array<{
    creatorId: string
    creatorName: string
    monthlyBudgetGbp: number
    profileStable: CreatorProfile | null
    profileLatest: CreatorProfile | null
  }>
): CreatorWatchList[] {
  return creators.map(({ creatorId, creatorName, monthlyBudgetGbp, profileStable, profileLatest }) => {
    if (!profileStable) {
      return { creatorId, creatorName, monthlyBudgetGbp, items: [], hasProfile: false }
    }

    const stableItems: WatchListItem[] = [
      ...profileStable.favoured_stocks
        .filter((s) => s.ticker !== null)
        .map((s) => ({
          ticker: s.ticker as string,
          name: s.name,
          conviction: s.conviction,
          layer: 'stable' as const,
          rationale: s.rationale,
        })),
      ...(profileStable.preferred_index_funds ?? [])
        .filter((f) => f.ticker !== null)
        .map((f) => ({
          ticker: f.ticker as string,
          name: f.name,
          conviction: 'medium' as const,
          layer: 'stable' as const,
          rationale: f.rationale,
        })),
    ]

    const latestItems: WatchListItem[] = profileLatest
      ? [
          ...profileLatest.favoured_stocks
            .filter((s) => s.ticker !== null)
            .map((s) => ({
              ticker: s.ticker as string,
              name: s.name,
              conviction: s.conviction,
              layer: 'latest' as const,
              rationale: s.rationale,
            })),
          ...(profileLatest.preferred_index_funds ?? [])
            .filter((f) => f.ticker !== null)
            .map((f) => ({
              ticker: f.ticker as string,
              name: f.name,
              conviction: 'medium' as const,
              layer: 'latest' as const,
              rationale: f.rationale,
            })),
        ]
      : []

    // If a ticker appears in both layers, keep the latest entry only.
    const latestTickers = new Set(latestItems.map((i) => i.ticker))
    const deduped = [
      ...stableItems.filter((i) => !latestTickers.has(i.ticker)),
      ...latestItems,
    ]

    const items = deduped.sort(
      (a, b) => CONVICTION_ORDER[a.conviction] - CONVICTION_ORDER[b.conviction]
    )

    return { creatorId, creatorName, monthlyBudgetGbp, items, hasProfile: true }
  })
}

export function calcShareQuantity(
  budgetGbp: Decimal,
  priceGbp: Decimal
): { quantity: Decimal; spent: Decimal; remainder: Decimal } {
  if (priceGbp.isZero() || priceGbp.isNegative()) {
    return { quantity: new Decimal(0), spent: new Decimal(0), remainder: budgetGbp }
  }
  const quantity = budgetGbp.div(priceGbp).floor()
  const spent = quantity.mul(priceGbp).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const remainder = budgetGbp.minus(spent).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  return { quantity, spent, remainder }
}
