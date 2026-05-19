import '@testing-library/jest-dom'

// Mock server-only so it doesn't throw in vitest test environment
// (server-only throws intentionally when imported outside Next.js server context)
vi.mock('server-only', () => ({}))
