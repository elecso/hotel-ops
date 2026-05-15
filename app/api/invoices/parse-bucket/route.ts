import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/server'
import { parseInvoiceFile } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json()
    if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

    const admin = await createAdminClient()

    // Download file from storage
    const { data: fileData, error: downloadErr } = await admin.storage.from('Invoice').download(path)
    if (downloadErr || !fileData) throw new Error(downloadErr?.message ?? 'Download failed')

    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Detect media type from filename
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    const mediaType = ext === 'pdf' ? 'application/pdf'
      : ext === 'png' ? 'image/png'
      : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : 'application/pdf'

    const lines = await parseInvoiceFile(base64, mediaType)

    // Generate signed URL for preview (valid 1 hour)
    const { data: signedUrlData } = await admin.storage.from('Invoice').createSignedUrl(path, 3600)

    return NextResponse.json({ lines, signedUrl: signedUrlData?.signedUrl ?? null })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
