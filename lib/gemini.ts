import { GoogleGenerativeAI } from '@google/generative-ai'

let geminiInstance: GoogleGenerativeAI | null = null

function getGemini(): GoogleGenerativeAI {
  if (!geminiInstance) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY est manquant. Ajoutez-le dans vos variables d\'environnement Vercel.')
    geminiInstance = new GoogleGenerativeAI(apiKey)
  }
  return geminiInstance
}

export interface ParsedInvoiceLine {
  raw_description: string
  qty: number
  unit: string
  unit_price: number
  total: number
  supplier_name?: string
  invoice_date?: string
}

const INVOICE_PROMPT = `You are a hotel procurement invoice parser. Extract every line item from the invoice.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "supplier_name": "vendor name or null",
  "invoice_date": "YYYY-MM-DD or null",
  "items": [
    { "raw_description": "exact product name", "qty": 1.0, "unit": "unit or empty string", "unit_price": 0.00, "total": 0.00 }
  ]
}

Rules:
- Include EVERY product/service line, even if qty or price is missing (use 0)
- Do NOT include subtotals, taxes, or section headers as items
- qty defaults to 1 if not shown; use 0 for unit_price/total if not found
- raw_description must be the actual product name`

export async function parseInvoiceWithGemini(base64Content: string, mediaType: string): Promise<ParsedInvoiceLine[]> {
  const ai = getGemini()
  const model = ai.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: { responseMimeType: 'application/json' },
  })

  const isPdf = mediaType.includes('pdf')
  const isImage = mediaType.startsWith('image/')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parts: any[]

  if (isPdf || isImage) {
    parts = [
      { inlineData: { mimeType: mediaType, data: base64Content } },
      { text: INVOICE_PROMPT },
    ]
  } else {
    // Text / CSV fallback
    const rawBuf = Buffer.from(base64Content, 'base64')
    const utf8 = rawBuf.toString('utf-8')
    const text = utf8.includes('') ? rawBuf.toString('latin1') : utf8
    parts = [`${INVOICE_PROMPT}\n\nDocument content:\n${text}`]
  }

  const result = await model.generateContent({ contents: [{ role: 'user', parts }] })
  const raw = result.response.text()

  let parsed: { supplier_name?: string; invoice_date?: string; items?: Array<Record<string, unknown>> }
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  return (parsed.items ?? []).map(item => ({
    raw_description: String(item.raw_description ?? ''),
    qty: Number(item.qty ?? 1),
    unit: String(item.unit ?? ''),
    unit_price: Number(item.unit_price ?? 0),
    total: Number(item.total ?? 0),
    supplier_name: String(parsed.supplier_name ?? item.supplier_name ?? ''),
    invoice_date: String(parsed.invoice_date ?? item.invoice_date ?? ''),
  }))
}
