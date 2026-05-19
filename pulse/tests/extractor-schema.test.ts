import { describe, it, expect, vi } from 'vitest'

// server-only throws when imported outside Next.js server context — mock it for tests
vi.mock('server-only', () => ({}))

import { SYSTEM_PROMPT, PROFILE_TOOL_DEF } from '@/lib/strategy/extractor'

describe('PROFILE_TOOL_DEF schema', () => {
  it('tool name is exactly "extract_creator_profile"', () => {
    expect(PROFILE_TOOL_DEF.name).toBe('extract_creator_profile')
  })

  it('favoured_stocks[].ticker uses anyOf [{type:string},{type:null}]', () => {
    const schema = PROFILE_TOOL_DEF.input_schema as any
    const tickerSchema = schema.properties.favoured_stocks.items.properties.ticker
    expect(tickerSchema).toHaveProperty('anyOf')
    expect(tickerSchema.anyOf).toContainEqual({ type: 'string' })
    expect(tickerSchema.anyOf).toContainEqual({ type: 'null' })
  })

  it('preferred_index_funds[].ticker uses anyOf [{type:string},{type:null}]', () => {
    const schema = PROFILE_TOOL_DEF.input_schema as any
    const tickerSchema = schema.properties.preferred_index_funds.items.properties.ticker
    expect(tickerSchema).toHaveProperty('anyOf')
    expect(tickerSchema.anyOf).toContainEqual({ type: 'string' })
    expect(tickerSchema.anyOf).toContainEqual({ type: 'null' })
  })

  it('conviction enum values are exactly ["high","medium","low"]', () => {
    const schema = PROFILE_TOOL_DEF.input_schema as any
    const convictionEnum = schema.properties.favoured_stocks.items.properties.conviction.enum
    expect(convictionEnum).toEqual(['high', 'medium', 'low'])
  })

  it('confidence has minimum:0 and maximum:100', () => {
    const schema = PROFILE_TOOL_DEF.input_schema as any
    expect(schema.properties.confidence.minimum).toBe(0)
    expect(schema.properties.confidence.maximum).toBe(100)
  })

  it('all required fields present in schema', () => {
    const schema = PROFILE_TOOL_DEF.input_schema as any
    expect(schema.required).toContain('methodology')
    expect(schema.required).toContain('favoured_stocks')
    expect(schema.required).toContain('sector_focus')
    expect(schema.required).toContain('preferred_index_funds')
    expect(schema.required).toContain('confidence')
    expect(schema.required).toContain('source_video_ids')
  })
})

describe('SYSTEM_PROMPT compliance (CI-03, CLAUDE.md)', () => {
  it('does not contain the word "recommend"', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).not.toContain('recommend')
  })

  it('does not contain the word "advise"', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).not.toContain('advise')
  })

  it('does not contain the word "suggest"', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).not.toContain('suggest')
  })

  it('instructs Claude to set ticker=null when symbol not cited', () => {
    expect(SYSTEM_PROMPT).toContain('null')
    expect(SYSTEM_PROMPT.toLowerCase()).toContain('ticker')
  })
})
