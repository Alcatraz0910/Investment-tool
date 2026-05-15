import {
  detectBroker,
  sanitiseTicker,
  convertGbxToGbp,
  classifyRow,
  BROKER_PRESETS,
} from '../parser'

describe('detectBroker', () => {
  it('detects Hargreaves Lansdown by required headers', () => {
    const headers = ['Stock', 'Units Held', 'Value (p)', 'Value (£)', 'Cost']
    expect(detectBroker(headers)?.name).toBe('Hargreaves Lansdown')
  })

  it('HL preset has gbx: true', () => {
    const hl = BROKER_PRESETS.find(p => p.name === 'Hargreaves Lansdown')
    expect(hl?.gbx).toBe(true)
  })

  it('detects AJ Bell by required headers', () => {
    const headers = ['Ticker/ISIN', 'Quantity', 'Market value', 'Description']
    expect(detectBroker(headers)?.name).toBe('AJ Bell')
  })

  it('AJ Bell preset has gbx: false', () => {
    const aj = BROKER_PRESETS.find(p => p.name === 'AJ Bell')
    expect(aj?.gbx).toBe(false)
  })

  it('returns null for unknown generic CSV', () => {
    const headers = ['Symbol', 'Shares', 'Price', 'Total']
    expect(detectBroker(headers)).toBeNull()
  })

  it('returns null when only partial required headers present', () => {
    const headers = ['Stock', 'Price']  // Missing 'Units Held'
    expect(detectBroker(headers)).toBeNull()
  })
})

describe('sanitiseTicker', () => {
  it('strips trailing .L suffix', () => {
    expect(sanitiseTicker('LLOY.L')).toBe('LLOY')
  })

  it('uppercases lowercase ticker', () => {
    expect(sanitiseTicker('voo')).toBe('VOO')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitiseTicker('  AAPL  ')).toBe('AAPL')
  })

  it('does NOT strip .L that is not a suffix (mid-ticker)', () => {
    expect(sanitiseTicker('LOL.LTD')).toBe('LOL.LTD')
  })

  it('handles clean ticker unchanged', () => {
    expect(sanitiseTicker('VWRP')).toBe('VWRP')
  })
})

describe('convertGbxToGbp', () => {
  it('converts 19800p to 198.00', () => {
    expect(convertGbxToGbp('19800')).toBe('198.00')
  })

  it('converts 100p to 1.00', () => {
    expect(convertGbxToGbp('100')).toBe('1.00')
  })

  it('converts 12350p to 123.50', () => {
    expect(convertGbxToGbp('12350')).toBe('123.50')
  })

  it('converts 1p to 0.01', () => {
    expect(convertGbxToGbp('1')).toBe('0.01')
  })

  it('handles string with whitespace', () => {
    expect(convertGbxToGbp('  500  ')).toBe('5.00')
  })
})

describe('classifyRow', () => {
  const existing = new Set(['LLOY', 'VWRP'])

  it('classifies new valid row as valid', () => {
    expect(classifyRow('AAPL', '10', '15.50', existing)).toBe('valid')
  })

  it('classifies existing ticker as duplicate', () => {
    expect(classifyRow('LLOY', '5', '100.00', existing)).toBe('duplicate')
  })

  it('strips .L before duplicate check', () => {
    expect(classifyRow('LLOY.L', '5', '100.00', existing)).toBe('duplicate')
  })

  it('classifies empty ticker as invalid', () => {
    expect(classifyRow('', '10', '100.00', existing)).toBe('invalid')
  })

  it('classifies whitespace-only ticker as invalid', () => {
    expect(classifyRow('   ', '10', '100.00', existing)).toBe('invalid')
  })

  it('classifies non-numeric quantity as invalid', () => {
    expect(classifyRow('AAPL', 'abc', '100.00', existing)).toBe('invalid')
  })

  it('classifies negative quantity as invalid', () => {
    expect(classifyRow('AAPL', '-5', '100.00', existing)).toBe('invalid')
  })

  it('classifies non-numeric value as invalid', () => {
    expect(classifyRow('AAPL', '10', 'xyz', existing)).toBe('invalid')
  })
})
