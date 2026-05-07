import 'server-only'
import { Pinecone, Index, RecordMetadata } from '@pinecone-database/pinecone'

let cached: Pinecone | null = null

/**
 * Pinecone singleton.
 * SDK v7+ auto-reads PINECONE_API_KEY from env when constructed without args.
 * RESEARCH Pattern 8.
 */
export function getPineconeClient(): Pinecone {
  if (cached) return cached
  const key = process.env.PINECONE_API_KEY
  const indexName = process.env.PINECONE_INDEX_NAME
  if (!key || !indexName) {
    throw new Error(
      'PINECONE_API_KEY or PINECONE_INDEX_NAME is not set. ' +
      'Add both to .env.local. ' +
      'Get the API key from Pinecone Dashboard → API keys. ' +
      'Index name should match the index you created (default: pulse-transcripts).'
    )
  }
  cached = new Pinecone({ apiKey: key })
  return cached
}

/**
 * Get a Pinecone namespace handle scoped to a single creator.
 * Namespace key = creator UUID string (matches creators.id PK).
 * All Phase 4 RAG queries scope by this namespace to retrieve only that creator's vectors.
 */
export function getPineconeNamespace(creatorId: string): Index<RecordMetadata> {
  const pc = getPineconeClient()
  const indexName = process.env.PINECONE_INDEX_NAME!
  return pc.index(indexName).namespace(creatorId)
}
