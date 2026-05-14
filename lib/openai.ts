import OpenAI from 'openai'

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

function extractJson(raw: string): string {
  // Strip markdown code fences
  let s = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  // Find the first [ or { and trim everything before it
  const arrIdx = s.indexOf('[')
  const objIdx = s.indexOf('{')
  if (arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx)) {
    s = s.substring(arrIdx)
    const lastBracket = s.lastIndexOf(']')
    if (lastBracket !== -1) s = s.substring(0, lastBracket + 1)
  } else if (objIdx !== -1) {
    s = s.substring(objIdx)
    const lastBrace = s.lastIndexOf('}')
    if (lastBrace !== -1) s = s.substring(0, lastBrace + 1)
  }
  return s
}

async function callGpt(systemPrompt: string, base64Content: string, mediaType: string, textPrefix: string): Promise<string> {
  const client = getOpenAI()
  const isPdf = mediaType.includes('pdf')
  const isImage = mediaType.startsWith('image/')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userContent: any

  if (isPdf) {
    userContent = [
      {
        type: 'file',
        file: {
          filename: 'document.pdf',
          file_data: `data:application/pdf;base64,${base64Content}`,
        },
      },
    ]
  } else if (isImage) {
    userContent = [
      {
        type: 'image_url',
        image_url: { url: `data:${mediaType};base64,${base64Content}`, detail: 'high' },
      },
    ]
  } else {
    const text = Buffer.from(base64Content, 'base64').toString('utf-8')
    userContent = `${textPrefix}\n${text}`
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '[]'
  return extractJson(raw)
}

export async function parseInvoiceFile(base64Content: string, mediaType: string): Promise<ParsedInvoiceLine[]> {
  const result = await callGpt(
    'You are a hotel procurement assistant. Extract all line items from this invoice as a JSON array: [{raw_description, qty, unit, unit_price, total, supplier_name, invoice_date}]. Return ONLY a valid JSON array. No markdown, no explanation, no extra text.',
    base64Content,
    mediaType,
    'Parse this invoice:'
  )
  return JSON.parse(result)
}

export async function parseFbFile(base64Content: string, mediaType: string): Promise<ParsedFbLine[]> {
  const result = await callGpt(
    'You are a restaurant sales analyst. Extract all sold items from this file as a JSON array: [{raw_name, qty}]. Return ONLY a valid JSON array. No markdown, no explanation, no extra text.',
    base64Content,
    mediaType,
    'Parse this F&B sales data:'
  )
  return JSON.parse(result)
}
