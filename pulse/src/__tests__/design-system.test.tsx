/**
 * UI-01: Design system token existence checks.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const cssPath = path.resolve(__dirname, '../app/globals.css')
const cssContent = fs.readFileSync(cssPath, 'utf8')

describe('design-system tokens (UI-01)', () => {
  it('globals.css contains --color-base: #1C1C1E', () => {
    expect(cssContent).toContain('--color-base: #1C1C1E')
  })

  it('globals.css contains --color-accent: #6366F1', () => {
    expect(cssContent).toContain('--color-accent: #6366F1')
  })

  it('globals.css body uses var(--color-base) not hardcoded hex', () => {
    expect(cssContent).toContain('var(--color-base)')
    expect(cssContent).not.toContain('background-color: #1C1C1E')
  })

  it('globals.css contains --color-surface: #2C2C2E', () => {
    expect(cssContent).toContain('--color-surface: #2C2C2E')
  })

  it('globals.css contains --color-border: #3A3A3C', () => {
    expect(cssContent).toContain('--color-border: #3A3A3C')
  })
})
