import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { parseXlsxFbFile, xlsxToText } from '@/lib/fb-parser'
import { parseFbFile } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel'

    if (isXlsx) {
      const lines = parseXlsxFbFile(arrayBuffer)
      if (lines.length > 0) return NextResponse.json(lines)

      // XLSX parsed but found nothing — convert to CSV text and try AI
      const csvText = xlsxToText(arrayBuffer)
      if (!csvText.trim()) {
        return NextResponse.json(
          { error: 'Fichier Excel vide ou illisible.' },
          { status: 400 }
        )
      }
      const base64 = Buffer.from(csvText, 'utf-8').toString('base64')
      const aiLines = await parseFbFile(base64, 'text/csv')
      return NextResponse.json(aiLines)
    }

    // PDF / CSV / plain text — AI parsing
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
