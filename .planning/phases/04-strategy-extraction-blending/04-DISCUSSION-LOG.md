# Phase 4: Strategy Extraction & Blending - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 4-Strategy-Extraction-Blending
**Areas discussed:** Extraction trigger, Claude model & output, Trust weight UI, Contradiction display

---

## Extraction Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto after Refresh | Extraction runs at end of transcript pipeline — one click does fetch → embed → extract | ✓ |
| Separate Extract button | Refresh only fetches/embeds; user triggers extraction separately | |

**User's choice:** Auto after Refresh

---

| Option | Description | Selected |
|--------|-------------|----------|
| Refresh succeeds, extraction fails separately | Transcripts stored = success; extraction failure is non-blocking warning | ✓ |
| Whole Refresh fails | Atomic: extraction failure marks whole refresh as failed | |

**User's choice:** Refresh succeeds, extraction fails separately

---

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing status line | Add "Extracting strategy..." as final step in Phase 3 step-status format | ✓ |
| Separate status below transcript list | Show extraction progress in a distinct section | |

**User's choice:** Extend existing status line

---

## Claude Model & Output

| Option | Description | Selected |
|--------|-------------|----------|
| claude-sonnet-4-6 | Fast, cost-effective, primary model per CLAUDE.md | ✓ |
| claude-opus-4-7 | Most capable, ~5× more expensive, better for subtle inference | |
| User-configurable | STRATEGY_MODEL env var — flexible but adds v1 overhead | |

**User's choice:** claude-sonnet-4-6

---

| Option | Description | Selected |
|--------|-------------|----------|
| tool_use / function calling | Forced valid JSON via tool schema — no parse errors | ✓ |
| JSON in system prompt | Simpler setup but Claude may add prose/markdown fences | |

**User's choice:** tool_use / function calling

---

| Option | Description | Selected |
|--------|-------------|----------|
| Top 20 chunks | ~10,000 tokens — balanced coverage for sonnet-4-6 | ✓ |
| Top 10 chunks | ~5,000 tokens — faster/cheaper but may miss spread context | |
| Top 40 chunks | ~20,000 tokens — max coverage, higher latency/cost | |

**User's choice:** Top 20 chunks

---

## Trust Weight UI

| Option | Description | Selected |
|--------|-------------|----------|
| Global slider + expandable per-category | One slider default, "Customize per category" toggle reveals 8 sliders | ✓ |
| Always show all 8 category sliders | Complete but dense (40 sliders for 5 creators) | |
| Global only | Only global weight for v1 — doesn't fully fulfil BLEND-01 | |

**User's choice:** Global slider + expandable per-category

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on creator card (Creators tab) | Contextually coherent — set trust while viewing strategy | ✓ |
| Dedicated Weights tab | Cleaner separation but breaks strategy context | |
| Modal on creator card | Extra click layer | |

**User's choice:** Inline on creator card in Creators tab

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-save on slider release | Debounced save on mouseup/touchend, green tick confirmation | ✓ |
| Explicit Save button | Safer for batch changes but adds friction | |

**User's choice:** Auto-save on slider release

---

## Contradiction Display

| Option | Description | Selected |
|--------|-------------|----------|
| Diff breakdown with badge | Amber badge + expandable diff table: "Tech: 40% → 65% (+25%) ⚠" | ✓ |
| Simple warning badge only | "⚠ Strategy changed" chip — less informative | |
| Tooltip on hover | Compact but discovery-dependent | |

**User's choice:** Diff breakdown with badge

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-clear on next extraction | Clears when all diffs ≤15% on next extraction | ✓ |
| User dismisses it | Manual "Acknowledged" button — guarantees user saw it | |

**User's choice:** Auto-clear on next extraction

---

## Claude's Discretion

- Exact system prompt wording (must avoid "advice", "recommend", "suggest")
- Pinecone query text for chunk retrieval (multiple queries suggested)
- Confidence score calculation method
- How to handle un-mentioned categories (suggested: omit vs default to 0%)
- `source_video_ids` array format in `creator_strategies`

## Deferred Ideas

None — discussion stayed within phase scope.
