import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { parseInvoiceFile } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const supplierId = formData.get('supplier_id') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mediaType = file.type || 'application/pdf'

    // Upload to Supabase Storage
    const fileName = `${Date.now()}-${file.name}`
    const { data: storageData } = await supabase.storage
      .from('invoices')
      .upload(fileName, arrayBuffer, { contentType: mediaType })

    const fileUrl = storageData?.path
      ? supabase.storage.from('invoices').getPublicUrl(storageData.path).data.publicUrl
      : null

    // Create invoice record
    const { data: invoice } = await supabase.from('invoices').insert({
      uploaded_by: user?.id,
      file_url: fileUrl,
      supplier_id: supplierId ? parseInt(supplierId) : null,
      status: 'ai_processed',
    }).select().single()

    // Parse with OpenAI
    const lines = await parseInvoiceFile(base64, mediaType)

    // Calculate total
    const total = lines.reduce((sum: number, l: { total?: number }) => sum + (l.total ?? 0), 0)
    await supabase.from('invoices').update({ total_amount: total }).eq('id', invoice.id)

    return NextResponse.json({ invoiceId: invoice.id, lines })
  } catch (e: unknown) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg.includes('JSON') ? 'Impossible de parser la facture. Vérifiez le format du fichier.' : msg },
      { status: 500 }
    )
  }
}
