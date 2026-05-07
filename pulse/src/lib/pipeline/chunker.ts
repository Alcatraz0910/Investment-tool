/**
 * Token-aware text chunker for transcript embedding.
 *
 * Uses js-tiktoken with cl100k_base encoding (the encoding for OpenAI's
 * text-embedding-3-small model). Default chunk size is 500 tokens with
 * 50-token overlap — well under the 8191-token per-input limit, with
 * enough overlap to preserve cross-chunk context.
 *
 * Pure function. No I/O. RESEARCH Pattern 6.
 */
import { getEncoding } from 'js-tiktoken'

let cachedEnc: ReturnType<typeof getEncoding> | null = null

function getEnc() {
  if (!cachedEnc) cachedEnc = getEncoding('cl100k_base')
  return cachedEnc
}

/**
 * Split `text` into overlapping token-aware chunks.
 *
 * @param text       the full transcript text
 * @param chunkSize  max tokens per chunk (default 500)
 * @param overlap    tokens of overlap between adjacent chunks (default 50)
 * @returns          array of decoded chunk strings (in original order)
 */
export function chunkText(
  text: string,
  chunkSize: number = 500,
  overlap: number = 50,
): string[] {
  if (!text || text.length === 0) return []
  if (chunkSize <= 0) throw new Error('chunkSize must be positive')
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error('overlap must be >= 0 and < chunkSize')
  }

  const enc = getEnc()
  const tokens = enc.encode(text)
  if (tokens.length === 0) return []

  const chunks: string[] = []
  const stride = chunkSize - overlap
  let start = 0

  while (start < tokens.length) {
    const end = Math.min(start + chunkSize, tokens.length)
    const slice = tokens.slice(start, end)
    chunks.push(enc.decode(slice))
    if (end === tokens.length) break
    start += stride
  }

  return chunks
}
