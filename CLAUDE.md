# Pulse — Project Guide

## What This Is

A personal UK Stocks & Shares ISA investment planning tool. It ingests YouTube creator transcripts, extracts asset allocation strategies using Claude AI (via RAG), blends multiple creator strategies using user-set trust weights, and produces a concrete monthly Buy List — exactly how to split a monthly budget across tickers to move the portfolio toward the target allocation.

## GSD Workflow

This project uses the Get Shit Done (GSD) planning workflow. All planning artifacts live in `.planning/`.

**Current state:** See `.planning/STATE.md`
**Requirements:** See `.planning/REQUIREMENTS.md`
**Roadmap:** See `.planning/ROADMAP.md`
**Project context:** See `.planning/PROJECT.md`

### Workflow Commands

```
/gsd-discuss-phase <n>   — Gather context before planning a phase
/gsd-plan-phase <n>      — Create PLAN.md for a phase
/gsd-execute-phase <n>   — Execute all plans in a phase
/gsd-verify-work         — Verify phase goal was achieved
/gsd-progress            — Check current status
```

### Starting Phase 1

```
/clear
/gsd-discuss-phase 1
```

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **Vector store:** Pinecone (creator transcript embeddings)
- **AI:** Anthropic Claude (claude-sonnet-4-6 or claude-opus-4-7) for strategy extraction
- **Embeddings:** OpenAI `text-embedding-3-small` (Pinecone vectors)
- **YouTube:** YouTube Data API v3 + `youtube-transcript` npm package
- **Arithmetic:** `decimal.js` for all £ calculations (no floating point)

## Critical Constraints

1. **No financial advice language** — All output must be framed as "creator-derived information." Never use "advice," "recommend," or "suggest" in user-facing plan output. Disclaimer required on all Buy List output.
2. **ISA limit is UK tax year** — £20,000 annual allowance resets 6 April (not 1 January). All ISA calculations must use the current UK tax year (6 Apr – 5 Apr).
3. **decimal.js for money** — Never use native JS floats for £ amounts. Use `new Decimal()` for all arithmetic in `PlanGenerator.ts` and related logic.
4. **RAG pattern for Claude** — Never send full transcript dumps to Claude. Always retrieve relevant Pinecone chunks first, then pass to Claude. Transcripts can exceed 100k tokens per creator.
5. **Manual-first (v1)** — No background jobs, no TrueLayer, no automated polling. All data refresh is user-triggered. Build for manual entry and manual refresh.

## Key Domain Knowledge

- **Stocks & Shares ISA:** UK tax-advantaged investment account. £20,000 annual allowance per person. Tax year runs 6 April – 5 April. Contributions are not withdrawable and re-added within the same tax year (unless it's a flexible ISA).
- **Asset allocation categories:** Index Funds, Stocks, Cash — use these as standard category names.
- **Creator strategy extraction:** Finance YouTubers rarely state explicit percentages. Claude must infer from language patterns. Always confidence-score inferences.
- **Strategy blending:** `unified_allocation[category] = Σ(creator_allocation[category] × weight[category]) / Σ(weight[category])` — weighted average per category.

## Project Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation | 🔲 Not started |
| 2 | Portfolio & Creator Management | 🔲 Not started |
| 3 | Transcript Pipeline | 🔲 Not started |
| 4 | Strategy Extraction & Blending | 🔲 Not started |
| 5 | Plan Generator | 🔲 Not started |
| 6 | Dashboard UI | 🔲 Not started |
