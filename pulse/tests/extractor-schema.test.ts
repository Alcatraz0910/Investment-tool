import { describe, it } from 'vitest'
// Import the SYSTEM_PROMPT constant when extractor.ts is rewritten.
// The import path below will resolve after Wave 2:
// import { SYSTEM_PROMPT } from '@/lib/strategy/extractor'

// CI-03: Schema compliance
describe('PROFILE_TOOL_DEF schema', () => {
  it.todo('tool name is exactly "extract_creator_profile"')
  it.todo('favoured_stocks[].ticker uses anyOf [{type:string},{type:null}]')
  it.todo('preferred_index_funds[].ticker uses anyOf [{type:string},{type:null}]')
  it.todo('conviction enum values are exactly ["high","medium","low"]')
  it.todo('confidence has minimum:0 maximum:100')
  it.todo('all required fields present: methodology, favoured_stocks, sector_focus, preferred_index_funds, confidence, source_video_ids')
})

// CI-03: No-advice language in SYSTEM_PROMPT
describe('SYSTEM_PROMPT compliance', () => {
  it.todo('SYSTEM_PROMPT does not contain the word "recommend"')
  it.todo('SYSTEM_PROMPT does not contain the word "advise"')
  it.todo('SYSTEM_PROMPT does not contain the word "suggest"')
  it.todo('SYSTEM_PROMPT instructs Claude to set ticker=null when symbol not cited')
})
