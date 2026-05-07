# Pulse — Milestones

## v1.0 MVP — Shipped 2026-05-07

**Phases:** 1–6 | **Plans:** 30 | **Commits:** 185 | **LOC:** ~6,900 TypeScript/TSX  
**Timeline:** 2026-05-06 → 2026-05-07 (2 days)

### Delivered

Full-stack personal UK ISA investment planning tool. Ingests YouTube creator transcripts, extracts asset allocation strategies via Claude RAG, blends multi-creator strategies with trust weights, and produces a concrete monthly Buy List with ISA cap enforcement. Premium glassmorphism dashboard with real-time contribution calculator and Recharts roadmap view.

### Key Accomplishments

1. Next.js 15 scaffold with Supabase auth, 9-table RLS schema, and TypeScript domain types
2. YouTube transcript pipeline: fetch, chunk, embed to Pinecone with idempotent refresh
3. Claude RAG strategy extraction: tool_use, contradiction detection, versioned snapshots
4. Multi-creator blending with per-category trust weights and Blend Summary
5. `generatePlan` (decimal.js): ISA-capped Buy List, fill-ticker routing, 18/18 vitest tests
6. Glassmorphism dashboard: 83 vitest tests, Recharts roadmap, Framer Motion transitions

### Archive

- Roadmap: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
- Audit: [v1.0-MILESTONE-AUDIT.md](v1.0-MILESTONE-AUDIT.md)

### Known Tech Debt at Close

- Phase 3 and Phase 6 missing formal VERIFICATION.md (code verified via SUMMARY evidence)
- VALIDATION.md files all in draft (nyquist_compliant: false)
- `unified_allocation: {}` stub in upsertBuyList (intentional)
- Pre-existing TS errors in creator-actions.ts (TS2353/TS2339)
