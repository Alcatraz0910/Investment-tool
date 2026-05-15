---
plan: "07-01"
status: complete
completed: 2026-05-15
---

# Summary: CSV Parser Utilities

## What was built

Installed PapaParse (+ types) and created `pulse/src/lib/csv/parser.ts` — a pure utility module with no browser or Supabase dependencies. It provides broker preset detection (HL and AJ Bell), ticker sanitisation (strips `.L` suffix via anchored regex), GBX-to-£ conversion (decimal.js `.div(100)`, never native float division), and row classification (valid / duplicate / invalid). All 24 unit tests pass.

## Tasks completed

- Task 1: Install papaparse + @types/papaparse; create `parser.ts` with five exported functions and broker preset registry
- Task 2: Create `pulse/src/lib/csv/__tests__/parser.test.ts` with 24 tests across all four describe blocks — all pass

## Files created/modified

- `pulse/package.json`: added papaparse to dependencies, @types/papaparse to devDependencies
- `pulse/src/lib/csv/parser.ts`: broker presets, detectBroker, sanitiseTicker, convertGbxToGbp, classifyRow, parseRows
- `pulse/src/lib/csv/__tests__/parser.test.ts`: 24 unit tests (vitest globals)

## Issues encountered

None. Note: plan specified `npx jest` but project uses Vitest — tests were run with `npx vitest run src/lib/csv` instead. Test syntax (describe/it/expect globals) is identical; all 24 tests passed.
