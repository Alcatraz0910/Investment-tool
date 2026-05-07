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
// English transcript text averages ~4 characters per token.
// Chunking by character count avoids WASM encode/decode entirely while
// keeping chunks well within OpenAI's 8191-token limit (500t × 4c = 2000 chars max).
const CHARS_PER_TOKEN = 4

/**
 * Split `text` into overlapping chunks approximated by token count.
 * Uses character-based splitting (4 chars ≈ 1 token) — no WASM dependency.
 *
 * @param text       the full transcript text
 * @param chunkSize  target tokens per chunk (default 500)
 * @param overlap    tokens of overlap between adjacent chunks (default 50)
 * @returns          array of chunk strings (in original order)
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

  const maxChars = chunkSize * CHARS_PER_TOKEN
  const strideChars = (chunkSize - overlap) * CHARS_PER_TOKEN
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    chunks.push(text.slice(start, start + maxChars))
    if (start + maxChars >= text.length) break
    start += strideChars
  }

  return chunks
}
