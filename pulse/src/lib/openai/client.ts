import 'server-only'
import OpenAI from 'openai'

let cached: OpenAI | null = null

/**
 * OpenAI singleton. Used for batch embedding via text-embedding-3-small.
 * RESEARCH Pattern 7. Model output dimension: 1536 (matches Pinecone index dim).
 */
export function getOpenAI(): OpenAI {
  if (cached) return cached
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY is not set. ' +
      'Add it to .env.local. ' +
      'Get one from OpenAI Dashboard → API keys.'
    )
  }
  cached = new OpenAI({ apiKey: key, timeout: 30_000 })
  return cached
}

/**
 * Batch-embed an array of text chunks using text-embedding-3-small.
 * Batches of 100 chunks per request (well under 2048 inputs / 300k token API limits).
 * Returns embeddings in the same order as input chunks.
 * Caller must ensure each chunk is ≤ 8191 tokens (use chunker.ts at ~500 tokens for safety).
 */
export async function embedChunks(chunks: string[]): Promise<number[][]> {
  if (chunks.length === 0) return []
  const openai = getOpenAI()
  const BATCH = 100
  const out: number[][] = []
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH)
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    })
    out.push(...res.data.map((d) => d.embedding))
  }
  return out
}
