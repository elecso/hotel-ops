import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { parseFbFile } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const date = formData.get('date') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mediaType = file.type || 'application/octet-stream'

    const lines = await parseFbFile(base64, mediaType)
    return NextResponse.json(lines)
  } catch (e: unknown) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg.includes('JSON') ? 'Impossible de parser la réponse AI. Vérifiez le format du fichier.' : msg },
      { status: 500 }
    )
  }
}
