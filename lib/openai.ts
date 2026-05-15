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

async function callResponsesAPI(base64Content: string, mediaType: string, userText: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY est manquant')

  const ext = mediaType.includes('pdf') ? 'pdf' : mediaType.includes('png') ? 'png' : 'jpg'
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      instructions: INVOICE_SYSTEM_PROMPT,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_file', filename: `invoice.${ext}`, file_data: `data:${mediaType};base64,${base64Content}` },
            { type: 'input_text', text: userText },
          ],
        },
      ],
      text: { format: { type: 'json_object' } },
    }),
  })

  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errData: any = await res.json().catch(() => ({}))
    throw new Error(errData?.error?.message ?? `OpenAI Responses API error ${res.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()
  return data.output_text ?? data.output?.[0]?.content?.[0]?.text ?? '{}'
}

export async function parseInvoiceFile(base64Content: string, mediaType: string): Promise<ParsedInvoiceLine[]> {
  const client = getOpenAI()
  const isPdf = mediaType.includes('pdf')
  const isImage = mediaType.startsWith('image/')

  let raw: string

  if (isPdf || isImage) {
    // Responses API natively understands PDFs and images — no text extraction needed
    raw = await callResponsesAPI(base64Content, mediaType, 'Extract all line items from this invoice and return a JSON object.')
  } else {
    // CSV / plain text — Chat Completions is sufficient
    const rawBuf = Buffer.from(base64Content, 'base64')
    const utf8 = rawBuf.toString('utf-8')
    const text = utf8.includes('�') ? rawBuf.toString('latin1') : utf8

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: INVOICE_SYSTEM_PROMPT },
        { role: 'user', content: `Extract all line items from this invoice.\n\n${text}` },
      ],
    })
    raw = response.choices[0]?.message?.content ?? '{}'
  }

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

export interface ScannedRequisitionLine {
  name: string
  qty: number
}

const REQUISITION_SCAN_PROMPT = `You are a hotel operations assistant. Extract all items from this requisition/request paper.

Return ONLY a JSON object (no markdown, no explanation):
{ "items": [{ "name": "product name", "qty": 1.0 }] }

Rules:
- Extract every product/item line requested
- Use the exact name written on the paper
- qty defaults to 1 if not shown
- Do not include headers or totals`

export async function scanRequisitionFile(base64Content: string, mediaType: string): Promise<ScannedRequisitionLine[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY est manquant')

  const ext = mediaType.includes('pdf') ? 'pdf' : mediaType.includes('png') ? 'png' : 'jpg'
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      instructions: REQUISITION_SCAN_PROMPT,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_file', filename: `requisition.${ext}`, file_data: `data:${mediaType};base64,${base64Content}` },
            { type: 'input_text', text: 'Extract all requested items from this requisition paper and return a JSON object.' },
          ],
        },
      ],
      text: { format: { type: 'json_object' } },
    }),
  })

  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errData: any = await res.json().catch(() => ({}))
    throw new Error(errData?.error?.message ?? `OpenAI Responses API error ${res.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()
  const raw = data.output_text ?? data.output?.[0]?.content?.[0]?.text ?? '{}'
  let parsed: { items?: Array<Record<string, unknown>> }
  try { parsed = JSON.parse(raw) } catch { return [] }

  return (parsed.items ?? []).map(item => ({
    name: String(item.name ?? ''),
    qty: Number(item.qty ?? 1),
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
