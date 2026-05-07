/**
 * Pulse — Domain Type Definitions
 *
 * D-08: Hand-written types modelling domain concepts (not raw DB rows).
 * D-09: Single flat file. Import as: import type { ... } from '@/types'
 *
 * Rules:
 * - All £ amount fields use Decimal (from decimal.js), never number.
 * - Field names are camelCase (snake_case in DB → camelCase here).
 * - Types model domain concepts; DB mapping is the app's responsibility.
 */
import { Decimal } from 'decimal.js'

// Re-export Decimal so other files can import it from '@/types'
export { Decimal }

// ---------------------------------------------------------------------------
// AssetCategory
// Standard 8 categories used across holdings, strategies, and weights.
// Must match CHECK constraints in schema.sql.
// ---------------------------------------------------------------------------
export type AssetCategory =
  | 'Tech'
  | 'Dividends'
  | 'Bonds'
  | 'Commodities'
  | 'Cash'
  | 'Emerging Markets'
  | 'Small Cap'
  | 'REITs'

// ---------------------------------------------------------------------------
// UserProfile
// Maps to public.users table. Created via trigger on auth signup.
// ---------------------------------------------------------------------------
export interface UserProfile {
  id: string
  email: string
  // £ monthly contribution budget — maps to public.users.monthly_budget (PORT-03)
  monthlyBudget: Decimal
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Creator
// Admin-managed curated creator list. Maps to public.creators.
// ---------------------------------------------------------------------------
export interface Creator {
  id: string
  channelUrl: string
  displayName: string
  channelId: string | null    // Populated in Phase 3 (YouTube channel ID)
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// UserCreator
// Join: user tracking a creator. Maps to public.user_creators.
// trustWeight: global default weight (0–100).
// Per-category overrides are in UserCreatorCategoryWeight (separate table).
// ---------------------------------------------------------------------------
export interface UserCreator {
  id: string
  userId: string
  creatorId: string
  trustWeight: number         // 0–100; global default; per-category via UserCreatorCategoryWeight
  lastRefreshedAt: Date | null   // Phase 3 (D-11) — NULL = never refreshed
  createdAt: Date
  creator?: Creator           // Optional join for display
  categoryWeights?: UserCreatorCategoryWeight[]  // Optional join for Phase 4
}

// ---------------------------------------------------------------------------
// UserCreatorCategoryWeight
// Per-category trust weight override for a user+creator pair.
// Maps to public.user_creator_category_weights (stub table defined in Phase 1).
// Used in Phase 4 strategy blending (BLEND-01).
// If a category has no row, the global trustWeight from UserCreator applies.
// ---------------------------------------------------------------------------
export interface UserCreatorCategoryWeight {
  id: string
  userCreatorId: string       // FK → user_creators.id
  category: AssetCategory
  weight: number              // 0–100
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Holding
// User's current portfolio position. Maps to public.holdings.
// quantity and currentValue use Decimal — never number for £ amounts.
// ---------------------------------------------------------------------------
export interface Holding {
  id: string
  userId: string
  ticker: string
  category: AssetCategory
  quantity: Decimal           // Number of shares/units
  currentValue: Decimal       // £ value — wrap DB NUMERIC in new Decimal() on read
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// ISAContribution
// Manual log of ISA contributions. Maps to public.isa_contributions.
// taxYear format: '2025-26' (6 Apr 2025 – 5 Apr 2026).
// amount uses Decimal — never number for £.
// ---------------------------------------------------------------------------
export interface ISAContribution {
  id: string
  userId: string
  amount: Decimal             // £ — new Decimal() on read from DB
  contributionDate: Date
  taxYear: string             // e.g. '2025-26'
  notes: string | null
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Transcript
// YouTube video transcript. Maps to public.transcripts.
// rawText is NULL until fetched in Phase 3.
// ---------------------------------------------------------------------------
export interface Transcript {
  id: string
  creatorId: string
  videoId: string             // YouTube video ID (unique)
  title: string
  publishedAt: Date
  rawText: string | null      // NULL until Phase 3 fetch
  wordCount: number | null
  isEmbedded: boolean         // TRUE after Pinecone upsert in Phase 3
  lastFetched: Date | null
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// RefreshJob
// Phase 3: Transcript pipeline progress state.
// Mirrors public.refresh_jobs row. One row per (user, creator) pair.
// Polled by the Refresh button client component every 2s.
// ---------------------------------------------------------------------------

/**
 * Phase 3: Transcript pipeline progress state.
 * Mirrors public.refresh_jobs row. One row per (user, creator) pair.
 * Polled by the Refresh button client component every 2s.
 */
export interface RefreshJob {
  id: string
  userId: string
  creatorId: string
  status: 'running' | 'done' | 'error' | 'idle'
  step: string | null
  summary: string | null
  error: string | null
  startedAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// AllocationMap
// Core domain type for asset allocation strategies.
// Maps to JSONB columns: creator_strategies.allocation, buy_lists.unified_allocation.
// Values are percentages (0–100); should sum to ~100 across a full strategy.
// Partial<Record<...>> because not all categories need to be present.
// ---------------------------------------------------------------------------
export type AllocationMap = Partial<Record<AssetCategory, number>>
// Example: { Tech: 60, Dividends: 20, Cash: 20 }

// ---------------------------------------------------------------------------
// CreatorStrategy
// Versioned AI-extracted allocation snapshot. Maps to public.creator_strategies.
// Each AI extraction creates a new row — full version history preserved (STRAT-02).
// ---------------------------------------------------------------------------
export interface CreatorStrategy {
  id: string
  creatorId: string
  allocation: AllocationMap   // JSONB → AllocationMap (D-04)
  confidence: number          // 0–100 (STRAT-03)
  sourceVideoIds: string[]    // YouTube video IDs cited (STRAT-03)
  hasContradiction: boolean   // TRUE if significant shift from prior version (STRAT-04)
  contradictionNote: string | null
  extractedAt: Date
  createdAt: Date
}

// ---------------------------------------------------------------------------
// BuyListItem
// One line in a monthly buy plan. Stored as JSONB in buy_lists.items.
// amountGbp uses Decimal — never number for £.
// ---------------------------------------------------------------------------
export interface BuyListItem {
  ticker: string
  category: AssetCategory
  amountGbp: Decimal          // £ — never number (PLAN-01 decimal.js constraint)
  rationale: string           // Creator-derived rationale (not "advice" — CLAUDE.md)
}

// ---------------------------------------------------------------------------
// BuyList
// Monthly generated plan. Maps to public.buy_lists.
// budgetGbp uses Decimal. items are BuyListItem[] (deserialized from JSONB).
// ---------------------------------------------------------------------------
export interface BuyList {
  id: string
  userId: string
  month: string               // 'YYYY-MM'
  budgetGbp: Decimal          // £ budget for this month
  items: BuyListItem[]        // Deserialized from JSONB
  unifiedAllocation: AllocationMap  // Blended strategy snapshot used for this plan
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Utility: DB → Domain type helpers (type signatures, not implementations)
// Implementations live in lib/mappers/ (Phase 2+).
// ---------------------------------------------------------------------------

/**
 * When reading NUMERIC columns from Supabase JS client, wrap in new Decimal().
 * Example: new Decimal(row.current_value) — do NOT use row.current_value directly as a number.
 * This prevents IEEE 754 float errors in portfolio calculations (CLAUDE.md constraint).
 */
export type DbNumeric = string | number  // Supabase JS returns NUMERIC as string or number depending on driver
