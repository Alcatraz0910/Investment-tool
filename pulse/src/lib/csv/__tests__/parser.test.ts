import {
  detectBroker,
  extractDataSection,
  sanitiseTicker,
  convertGbxToGbp,
  classifyRow,
  BROKER_PRESETS,
} from '../parser'

describe('detectBroker', () => {
  it('detects Hargreaves Lansdown by required headers', () => {
    const headers = ['Code', 'Description', 'Units held', 'Price (p)', 'Value (£)', 'Cost (£)']
    expect(detectBroker(headers)?.name).toBe('Hargreaves Lansdown')
  })

  it('HL preset has gbx: false (Value (£) already in pounds)', () => {
    const hl = BROKER_PRESETS.find(p => p.name === 'Hargreaves Lansdown')
    expect(hl?.gbx).toBe(false)
  })

  it('HL preset tickerCol is Code', () => {
    const hl = BROKER_PRESETS.find(p => p.name === 'Hargreaves Lansdown')
    expect(hl?.tickerCol).toBe('Code')
  })

  it('HL preset quantityCol is Units', () => {
    const hl = BROKER_PRESETS.find(p => p.name === 'Hargreaves Lansdown')
    expect(hl?.quantityCol).toBe('Units held')
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
    const headers = ['Code', 'Price']  // Missing 'Units'
    expect(detectBroker(headers)).toBeNull()
  })
})

describe('extractDataSection', () => {
  const hlCsv = [
    'HL Stocks & Shares ISA',
    'Client Name:,John Smith',
    'Client Number:,12345678',
    'Spreadsheet created at,2025-01-01',
    'Stock value:,£10000.00',
    'Total cash:,£0.00',
    'Amount available to invest:,£0.00',
    'Total value:,£10000.00',
    '',
    'Code,Description,Units,Price (p),Value (£),Cost (£),Gain/Loss (£),Gain/Loss (%)',
    'VWRL,Vanguard FTSE All-World ETF,50,8500.00,4250.00,4000.00,250.00,6.25',
    'SGLN,iShares Physical Gold,100,2000.00,2000.00,1800.00,200.00,11.11',
  ].join('\n')

  it('strips HL metadata rows and returns from Code row onwards', () => {
    const result = extractDataSection(hlCsv)
    expect(result.startsWith('Code,')).toBe(true)
  })

  it('preserves all data rows after the header', () => {
    const result = extractDataSection(hlCsv)
    expect(result).toContain('VWRL')
    expect(result).toContain('SGLN')
  })

  it('returns original text when no known data marker found', () => {
    const genericCsv = 'Symbol,Qty,Price\nAAPL,10,150'
    expect(extractDataSection(genericCsv)).toBe(genericCsv)
  })

  it('handles quoted first cell', () => {
    const quotedCsv = '"Code","Description","Units"\n"VWRL","Vanguard",50'
    const result = extractDataSection(quotedCsv)
    expect(result.startsWith('"Code"')).toBe(true)
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
