import * as XLSX from 'xlsx'

export interface ParsedFbLine {
  raw_name: string
  qty: number
}

function normalise(s: string) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function matchColumn(header: string): 'name' | 'qty' | null {
  const h = normalise(header)
  if (
    h === 'nom' || h === 'name' || h === 'article' || h === 'libelle' ||
    h === 'designation' || h === 'description' || h === 'produit' ||
    h === 'intitule' || h === 'label' || h === 'libelle article' ||
    h === 'reference' || h === 'ref' || h === 'famille article' ||
    h.startsWith('nom ') || h.startsWith('article ') || h.startsWith('libelle') ||
    h.includes('produit') || h.includes('article') || h.includes('libelle') ||
    h.includes('designation') || h.includes('intitule')
  ) return 'name'
  if (
    h === 'qte' || h === 'qty' || h === 'nb' || h === 'qt' || h === 'qte.' ||
    h === 'nbre' || h === 'nbr' || h === 'count' || h === 'total' ||
    h.includes('brut') || h.includes('vendu') || h.includes('vente') ||
    h.includes('qte') || h.includes('qty') || h.includes('quant') ||
    h.includes('nbr') || h.includes('nombre') || h.includes('nb ') ||
    h.includes('couvert') || h.includes('ventes') || h.includes('ticket') ||
    h.includes('couverts') || h.includes('portions')
  ) return 'qty'
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

  // Pass 1 — look for named columns in first 30 rows
  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i]
    let foundName = false
    for (let j = 0; j < row.length; j++) {
      const match = matchColumn(String(row[j] ?? ''))
      if (match === 'name' && nameCol < 0) { nameCol = j; foundName = true }
      if (match === 'qty' && qtyCol < 0) qtyCol = j
    }
    if (foundName) { headerRowIdx = i; break }
  }

  // Pass 2 — heuristic: find first row with multiple non-empty cells, pick longest text col + first number col
  if (headerRowIdx < 0) {
    for (let i = 0; i < Math.min(50, data.length); i++) {
      const row = data[i]
      const nonEmpty = row.filter((c: unknown) => String(c ?? '').trim())
      if (nonEmpty.length < 2) continue
      // Find first cell that is text (not a number, date-like or empty)
      for (let j = 0; j < row.length; j++) {
        const val = String(row[j] ?? '').trim()
        if (!val) continue
        const num = parseFloat(val.replace(',', '.'))
        if (isNaN(num) && nameCol < 0) { nameCol = j }
        else if (!isNaN(num) && qtyCol < 0 && nameCol >= 0) { qtyCol = j }
      }
      if (nameCol >= 0) { headerRowIdx = i; break }
    }
  }

  if (headerRowIdx < 0 || nameCol < 0) return []

  const lines: ParsedFbLine[] = []
  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i]
    const name = String(row[nameCol] ?? '').trim()
    if (!name) continue

    const rawQty = qtyCol >= 0 ? String(row[qtyCol] ?? '').replace(',', '.') : '0'
    const qty = parseFloat(rawQty)

    const norm = normalise(name)
    if (norm.startsWith('total') || norm.startsWith('sous-total') || norm.startsWith('subtotal')) continue

    lines.push({ raw_name: name, qty: isNaN(qty) ? 0 : qty })
  }
  return lines
}

/** Convert XLSX sheet to a plain-text representation for AI fallback */
export function xlsxToText(buffer: ArrayBuffer): string {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_csv(ws)
}
