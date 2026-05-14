import * as XLSX from 'xlsx'

export interface ParsedFbLine {
  raw_name: string
  qty: number
}

function matchColumn(header: string): 'name' | 'qty' | null {
  const h = header.toLowerCase().trim()
  if (h === 'nom' || h === 'article' || h === 'libellé') return 'name'
  if (h.includes('brut') || h.includes('vendues brut') || h.includes('qté')) return 'qty'
  return null
}

export function parseXlsxFbFile(buffer: ArrayBuffer): ParsedFbLine[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  let headerRowIdx = -1
  let nameCol = -1
  let qtyCol = -1

  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i]
    let foundName = false
    for (let j = 0; j < row.length; j++) {
      const match = matchColumn(String(row[j] ?? ''))
      if (match === 'name') { nameCol = j; foundName = true }
      if (match === 'qty') qtyCol = j
    }
    if (foundName) { headerRowIdx = i; break }
  }

  if (headerRowIdx < 0 || nameCol < 0) return []

  const lines: ParsedFbLine[] = []
  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i]
    const name = String(row[nameCol] ?? '').trim()
    if (!name) continue

    const qty = qtyCol >= 0 ? parseFloat(String(row[qtyCol] ?? '0').replace(',', '.')) : 0

    if (name.toLowerCase().includes('total') || name.toLowerCase().includes('sous-total')) continue
    if (qty === 0) continue

    lines.push({
      raw_name: name,
      qty: isNaN(qty) ? 0 : qty,
    })
  }
  return lines
}
