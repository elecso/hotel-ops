import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
  unit_price: number
  total_revenue: number
}

export async function parseInvoiceFile(base64Content: string, mediaType: string): Promise<ParsedInvoiceLine[]> {
  const isPdf = mediaType === 'application/pdf'

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: 'You are a hotel procurement assistant. Extract all line items from this invoice as a JSON array: [{raw_description, qty, unit, unit_price, total, supplier_name, invoice_date}]. Return ONLY valid JSON. No markdown, no preamble, no explanation.',
    messages: [{
      role: 'user',
      content: isPdf
        ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Content } }]
        : [{ type: 'text', text: `Parse this invoice data:\n${Buffer.from(base64Content, 'base64').toString('utf-8')}` }],
    }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned)
}

export async function parseFbFile(base64Content: string, mediaType: string): Promise<ParsedFbLine[]> {
  const isPdf = mediaType === 'application/pdf'

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: 'You are a restaurant sales analyst. Extract all sold items from this file as JSON: [{raw_name, qty, unit_price, total_revenue}]. Return ONLY valid JSON. No markdown, no preamble.',
    messages: [{
      role: 'user',
      content: isPdf
        ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Content } }]
        : [{ type: 'text', text: `Parse this F&B sales data:\n${Buffer.from(base64Content, 'base64').toString('utf-8')}` }],
    }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned)
}
