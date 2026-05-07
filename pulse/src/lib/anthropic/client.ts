import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

let cached: Anthropic | null = null

/**
 * Anthropic singleton. Used for strategy extraction via tool_use.
 * Follows the singleton pattern of lib/openai/client.ts and lib/pinecone/client.ts.
 * RESEARCH Pattern 1. Model: claude-sonnet-4-6 (D-04).
 */
export function getAnthropic(): Anthropic {
  if (cached) return cached
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. ' +
      'Add it to .env.local. ' +
      'Get one from https://console.anthropic.com/settings/keys'
    )
  }
  cached = new Anthropic({ apiKey: key })
  return cached
}
