import * as XLSX from 'xlsx'

export interface ParsedFbLine {
  raw_name: string
  qty: number
  unit_price: number
  total_revenue: number
}

// Matches "Nom", "Quantités vendues brutes sur article", "Ventes moins remises sur articles ventes"
function matchColumn(header: string): 'name' | 'qty' | 'revenue' | null {
  const h = header.toLowerCase().trim()
  if (h === 'nom' || h === 'article' || h === 'libellé') return 'name'
  if (h.includes('brut') || h.includes('vendues brut') || h.includes('qté')) return 'qty'
  if (h.includes('remises') || h.includes('ventes moins') || h.includes('net') || h.includes('montant')) return 'revenue'
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
  let revenueCol = -1

  // Search first 30 rows for the header
  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i]
    let foundName = false
    for (let j = 0; j < row.length; j++) {
      const match = matchColumn(String(row[j] ?? ''))
      if (match === 'name') { nameCol = j; foundName = true }
      if (match === 'qty') qtyCol = j
      if (match === 'revenue') revenueCol = j
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
    const revenue = revenueCol >= 0 ? parseFloat(String(row[revenueCol] ?? '0').replace(',', '.')) : 0

    // Skip total/subtotal rows
    if (name.toLowerCase().includes('total') || name.toLowerCase().includes('sous-total')) continue
    if (qty === 0 && revenue === 0) continue

    lines.push({
      raw_name: name,
      qty: isNaN(qty) ? 0 : qty,
      unit_price: qty > 0 && revenue > 0 ? revenue / qty : 0,
      total_revenue: isNaN(revenue) ? 0 : revenue,
    })
  }
  return lines
}
