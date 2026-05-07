---
status: complete
phase: 06-dashboard-ui
source:
  - 06-00-SUMMARY.md
  - 06-01-SUMMARY.md
  - 06-02-SUMMARY.md
  - 06-03-SUMMARY.md
  - 06-04-SUMMARY.md
  - 06-05-SUMMARY.md
started: 2026-05-07T00:00:00Z
updated: 2026-05-07T00:00:00Z
---

## Current Test

number: 12
name: Strategy Conflict Badge
expected: |
  If a creator has a significant strategy shift between their last two refreshes,
  the badge on their card reads "Strategy conflict detected" (not "Strategy shift
  detected"). The badge is amber/yellow coloured.
result: complete

## Tests

### 1. Dashboard Shell Appearance
expected: Open /dashboard. The page background is Space Grey (very dark near-black). The main card container has a frosted-glass (glassmorphism) look with a subtle white border and backdrop blur. The active tab label is Electric Indigo (bright purple-blue). Inactive tabs are muted, turn white on hover.
result: pass

### 2. Tab Fade Animation
expected: Click between the Portfolio tab and the Plan tab. Each switch should play a short fade + slight upward slide animation (~200ms). The content doesn't snap — it fades out then fades in.
result: pass

### 3. Action Plan — Buy List Cards + Disclaimer
expected: On the Plan tab, the Buy List shows each ticker as a card (not a table row). The text "Creator-derived information — not financial advice" is visible below or within the list. Clicking on any ticker card expands an accordion showing the rationale text and the % gap it closes.
result: issue
reported: "yes but no other asset appears here even though i have more holdings"
severity: major

### 4. Action Plan — Accordion Collapse
expected: After expanding a ticker's accordion (test 3), click the same ticker again. The accordion should collapse. Only one ticker can be expanded at a time — expanding a second one closes the first.
result: pass

### 5. Contribution Calculator — Real-time Update
expected: Drag the budget slider on the Plan tab. The Buy List should update immediately as you drag — no button press, no loading spinner, no perceptible delay. The slider value label updates live.
result: pass

### 6. ISA Warning Banner
expected: If you have ISA remaining allowance and set the slider above it, a red warning banner appears in the Plan tab (above the Buy List). The Buy List total shown should be capped to your remaining allowance, not the full slider value.
result: skipped
reason: ISA remaining allowance too close to £20,000 to trigger the threshold

### 7. Roadmap View Chart
expected: Below the Contribution Calculator on the Plan tab, a line chart is visible titled "Portfolio Roadmap" (or similar). It shows two lines: "Your Current Path" and "Creator's Vision". The X-axis shows months, the Y-axis shows £ values. Hovering a data point shows a glassmorphism tooltip with £ amounts.
result: pass

### 8. Roadmap View — Divergence Visible
expected: If your current portfolio allocation differs from the creator strategy (e.g. you hold 0% in one category the creator targets at 60%), the two lines on the Roadmap chart should diverge — not overlap. The chart subtitle should name the category with the largest gap.
result: issue
reported: "subtitle naming the largest gap category doesn't appear below the chart"
severity: minor

### 9. Creator Cards Stagger Animation
expected: Navigate to the Creators tab. If you have tracked creators, their cards should load with a stagger — cards appearing one after another with a slight delay (~50ms per card), each sliding up from slightly below.
result: pass

### 10. Creator Card — Confidence + Last Refreshed
expected: Each creator card shows: the creator's name, a "Confidence: N%" label, a "Last refreshed DD/MM/YYYY" date (or "Never" if not yet refreshed), and the strategy allocation breakdown (e.g. "Index Funds 60%").
result: issue
reported: "allocation chips show Cash 50%, Stocks 50%, Index Funds 50% — totals 150%, not 100%"
severity: major

### 11. Trust Weight Slider — Save Indicator
expected: On a creator card with a Trust Weight slider, adjust the slider and release it. A brief saving indicator appears (spinner or similar), then a ✓ tick confirms the save. If you adjust and release again, it saves again.
result: pass

### 12. Strategy Conflict Badge
expected: If a creator has a significant strategy shift between their last two refreshes, the badge on their card reads "Strategy conflict detected" (not "Strategy shift detected"). The badge is amber/yellow coloured.
result: pass

## Summary

total: 12
passed: 8
issues: 3
skipped: 1
pending: 0

## Gaps

- truth: "Buy List shows all applicable tickers from the blended strategy, not just one"
  status: resolved
  reason: "User reported: only one asset appears. Root cause: only one holding marked isFillTicker=true. By design — user must toggle fill ticker on each holding in Portfolio tab."
  severity: major
  test: 3
  fix: "UX — user action required: enable fill ticker toggle on each holding in Portfolio tab"
- truth: "Roadmap chart subtitle names the category with the largest gap"
  status: fixed
  reason: "Subtitle existed in code but text-zinc-500/text-xs made it invisible. Fixed: dedicated paragraph with text-zinc-400 and accent-coloured category name."
  severity: minor
  test: 8
  fix: "commit b3c9ce0 — RoadmapView.tsx subtitle styling"
- truth: "Creator card allocation chips sum to 100% across all categories"
  status: fixed
  reason: "Extractor stored per-category values summing to 150%. StrategyCard now normalises raw allocation to 100% before display, with '(normalised to 100%)' note when divergence > 5%."
  severity: major
  test: 10
  fix: "commit b3c9ce0 — StrategyCard.tsx normalisation"
