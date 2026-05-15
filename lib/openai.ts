import OpenAI from 'openai'

let openaiInstance: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey === 'your_openai_api_key') {
      throw new Error('OPENAI_API_KEY est manquant ou invalide.')
    }
    openaiInstance = new OpenAI({ apiKey })
  }
  return openaiInstance
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

export interface ParsedFbLine {
  raw_name: string
  qty: number
}

const INVOICE_SYSTEM_PROMPT = `You are a hotel procurement invoice parser. Extract every line item from the invoice.

Return ONLY a JSON object (no markdown, no explanation):
{
  "supplier_name": "vendor name or null",
  "invoice_date": "YYYY-MM-DD or null",
  "items": [
    { "raw_description": "exact product name", "qty": 1.0, "unit": "unit or empty string", "unit_price": 0.00, "total": 0.00 }
  ]
}

Rules:
- Include EVERY product/service line, even if qty or price is missing (use 0)
- Do NOT include subtotals, taxes, or section headers
- qty defaults to 1 if not shown; use 0 for unit_price/total if missing
- raw_description must be the actual product name`

export async function parseInvoiceFile(base64Content: string, mediaType: string): Promise<ParsedInvoiceLine[]> {
  const client = getOpenAI()
  const isPdf = mediaType.includes('pdf')
  const isImage = mediaType.startsWith('image/')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userContent: any

  if (isImage) {
    userContent = [
      { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64Content}`, detail: 'high' } },
      { type: 'text', text: 'Extract all line items from this invoice.' },
    ]
  } else if (isPdf) {
    // Extract readable text from the PDF buffer (works for non-scanned PDFs)
    const rawBuf = Buffer.from(base64Content, 'base64')
    const raw = rawBuf.toString('latin1')
    // Keep printable ASCII + strip binary noise; grab up to 12 000 chars
    const text = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/[ \t]{4,}/g, '   ').substring(0, 12000)
    userContent = `Extract all line items from this invoice.\n\nExtracted PDF text:\n${text}`
  } else {
    // CSV / plain text
    const rawBuf = Buffer.from(base64Content, 'base64')
    const utf8 = rawBuf.toString('utf-8')
    const text = utf8.includes('�') ? rawBuf.toString('latin1') : utf8
    userContent = `Extract all line items from this invoice.\n\n${text}`
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: INVOICE_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  let parsed: { supplier_name?: string; invoice_date?: string; items?: Array<Record<string, unknown>> }
  try { parsed = JSON.parse(raw) } catch { return [] }

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

const FB_SYSTEM_PROMPT = `You are a restaurant sales analyst. Extract all sold items from this F&B sales file.

Return ONLY a JSON object: { "items": [{ "raw_name": "product name", "qty": 0.0 }] }

Include ALL products listed, even those with quantity 0. Do not skip any item.`

export async function parseFbFile(base64Content: string, mediaType: string): Promise<ParsedFbLine[]> {
  const client = getOpenAI()
  const isImage = mediaType.startsWith('image/')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userContent: any

  if (isImage) {
    userContent = [
      { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64Content}`, detail: 'high' } },
      { type: 'text', text: 'Extract all items from this F&B sales data.' },
    ]
  } else {
    const rawBuf = Buffer.from(base64Content, 'base64')
    const utf8 = rawBuf.toString('utf-8')
    const text = utf8.includes('�') ? rawBuf.toString('latin1') : utf8
    userContent = `Extract all items from this F&B sales data:\n\n${text}`
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: FB_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  let parsed: { items?: Array<Record<string, unknown>> }
  try { parsed = JSON.parse(raw) } catch { return [] }

  return (parsed.items ?? []).map(item => ({
    raw_name: String(item.raw_name ?? ''),
    qty: Number(item.qty ?? 0),
  }))
}
