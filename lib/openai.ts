import OpenAI from 'openai'

let openaiInstance: OpenAI | null = null

function getOpenAI() {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey || apiKey === 'your_openai_api_key') {
      console.warn('OPENAI_API_KEY is missing or using placeholder.')
      return {
        chat: {
          completions: {
            create: async () => {
              throw new Error('Cannot use OpenAI: API key is missing or invalid.')
            }
          }
        }
      } as unknown as OpenAI
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
  unit_price: number
  total_revenue: number
}

export async function parseInvoiceFile(base64Content: string, mediaType: string): Promise<ParsedInvoiceLine[]> {
  const isPdf = mediaType === 'application/pdf'

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = isPdf
    ? [{
        type: 'image_url' as const,
        image_url: { url: `data:${mediaType};base64,${base64Content}` }
      }]
    : [{
        type: 'text' as const,
        text: `Parse this invoice data:\n${Buffer.from(base64Content, 'base64').toString('utf-8')}`
      }]

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: 'You are a hotel procurement assistant. Extract all line items from this invoice as a JSON array: [{raw_description, qty, unit, unit_price, total, supplier_name, invoice_date}]. Return ONLY valid JSON. No markdown, no preamble, no explanation.',
      },
      { role: 'user', content },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '[]'
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned)
}

export async function parseFbFile(base64Content: string, mediaType: string): Promise<ParsedFbLine[]> {
  const isPdf = mediaType === 'application/pdf'

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = isPdf
    ? [{
        type: 'image_url' as const,
        image_url: { url: `data:${mediaType};base64,${base64Content}` }
      }]
    : [{
        type: 'text' as const,
        text: `Parse this F&B sales data:\n${Buffer.from(base64Content, 'base64').toString('utf-8')}`
      }]

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: 'You are a restaurant sales analyst. Extract all sold items from this file as JSON: [{raw_name, qty, unit_price, total_revenue}]. Return ONLY valid JSON. No markdown, no preamble.',
      },
      { role: 'user', content },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '[]'
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned)
}
