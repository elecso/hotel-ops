import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { parseXlsxFbFile } from '@/lib/fb-parser'
import { parseFbFile } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const date = formData.get('date') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel'

    if (isXlsx) {
      const lines = parseXlsxFbFile(arrayBuffer)
      if (lines.length > 0) return NextResponse.json(lines)
      // XLSX parsed but found nothing — likely unrecognised headers, don't send binary to AI
      return NextResponse.json(
        { error: 'Colonnes non reconnues dans le fichier Excel. Vérifiez que les en-têtes contiennent "Nom" et une colonne de quantité (ex: "Quantités vendues brutes").' },
        { status: 400 }
      )
    }

    // Fallback: AI parsing for PDF / CSV / plain-text formats only
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
