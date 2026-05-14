import OpenAI, { toFile } from 'openai'

let openaiInstance: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey === 'your_openai_api_key') {
      throw new Error('OPENAI_API_KEY est manquant ou invalide. Vérifiez vos variables d\'environnement.')
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGptJson<T>(systemPrompt: string, base64Content: string, mediaType: string, textPrefix: string): Promise<T> {
  const client = getOpenAI()
  const isPdf = mediaType.includes('pdf')
  const isImage = mediaType.startsWith('image/')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userContent: any
  let uploadedFileId: string | null = null

  if (isPdf) {
    const pdfBuffer = Buffer.from(base64Content, 'base64')
    const pdfFile = await toFile(pdfBuffer, 'document.pdf', { type: 'application/pdf' })
    const uploaded = await client.files.create({ file: pdfFile, purpose: 'user_data' })
    uploadedFileId = uploaded.id
    userContent = [
      { type: 'file', file: { file_id: uploaded.id } },
      { type: 'text', text: textPrefix },
    ]
  } else if (isImage) {
    userContent = [
      { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64Content}`, detail: 'high' } },
      { type: 'text', text: textPrefix },
    ]
  } else {
    const rawBuf = Buffer.from(base64Content, 'base64')
    const utf8 = rawBuf.toString('utf-8')
    const text = utf8.includes('') ? rawBuf.toString('latin1') : utf8
    userContent = `${textPrefix}\n${text}`
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    return JSON.parse(raw) as T
  } finally {
    if (uploadedFileId) {
      await client.files.del(uploadedFileId).catch(() => {})
    }
  }
}

const INVOICE_SYSTEM_PROMPT = `You are a hotel procurement invoice parser. Your task is to extract every line item from the invoice document provided.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "supplier_name": "supplier or vendor name, or null",
  "invoice_date": "date in YYYY-MM-DD format, or null",
  "items": [
    {
      "raw_description": "exact product or service name as it appears on the invoice",
      "qty": 1.0,
      "unit": "unit of measure (pcs, kg, L, box, etc.) or empty string",
      "unit_price": 0.00,
      "total": 0.00
    }
  ]
}

Rules:
- Include EVERY product/service line item, even if some fields are missing (use 0 for missing numbers, "" for missing text)
- Do NOT include subtotals, grand totals, taxes, or section headers as items
- qty defaults to 1 if not shown; unit_price and total default to 0 if not shown
- raw_description must be the actual product name, not a category label
- If qty and unit_price are present, total = qty × unit_price`

export async function parseInvoiceFile(base64Content: string, mediaType: string): Promise<ParsedInvoiceLine[]> {
  const result = await callGptJson<{
    supplier_name?: string
    invoice_date?: string
    items?: Array<Record<string, unknown>>
  }>(
    INVOICE_SYSTEM_PROMPT,
    base64Content,
    mediaType,
    'Extract all line items from this invoice and return as a JSON object.'
  )

  return (result.items ?? []).map(item => ({
    raw_description: String(item.raw_description ?? ''),
    qty: Number(item.qty ?? 1),
    unit: String(item.unit ?? ''),
    unit_price: Number(item.unit_price ?? 0),
    total: Number(item.total ?? 0),
    supplier_name: String(result.supplier_name ?? item.supplier_name ?? ''),
    invoice_date: String(result.invoice_date ?? item.invoice_date ?? ''),
  }))
}

const FB_SYSTEM_PROMPT = `You are a restaurant sales analyst. Extract all sold items from this F&B sales file.

Return ONLY a JSON object: { "items": [{ "raw_name": "product name", "qty": 0.0 }] }

Include ALL products listed, even those with quantity 0. Do not skip any item.`

export async function parseFbFile(base64Content: string, mediaType: string): Promise<ParsedFbLine[]> {
  const result = await callGptJson<{ items?: Array<Record<string, unknown>> }>(
    FB_SYSTEM_PROMPT,
    base64Content,
    mediaType,
    'Extract all items from this F&B sales data and return as a JSON object.'
  )

  return (result.items ?? []).map(item => ({
    raw_name: String(item.raw_name ?? ''),
    qty: Number(item.qty ?? 0),
  }))
}
