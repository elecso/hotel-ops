import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'

interface CsvRow {
  name: string
  sku?: string
  unit?: string
  packaging_desc?: string
  packaging_qty?: string
  price_excl_tax?: string
  min_stock?: string
  delivery_days?: string
  purchase_url?: string
  hotel_scope?: string
  category_name?: string
  supplier_name?: string
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())

  return lines.slice(1).map(line => {
    // Handle quoted fields with commas inside
    const values: string[] = []
    let cur = ''
    let inQuote = false
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    values.push(cur.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row as CsvRow
  }).filter(r => r.name)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé — admin uniquement' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    if (!file || !type) return NextResponse.json({ error: 'Fichier ou type manquant' }, { status: 400 })

    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) return NextResponse.json({ error: 'Fichier vide ou format invalide' }, { status: 400 })

    let created = 0
    let updated = 0

    for (const row of rows) {
      // Find or create supplier
      let supplierId: number | null = null
      if (row.supplier_name?.trim()) {
        const { data: existing } = await supabase
          .from('suppliers').select('id').ilike('name', row.supplier_name.trim()).single()
        if (existing) {
          supplierId = existing.id
        } else {
          const { data: newSupplier } = await supabase
            .from('suppliers').insert({ name: row.supplier_name.trim() }).select('id').single()
          supplierId = newSupplier?.id ?? null
        }
      }

      // Find or create category
      let categoryId: number | null = null
      if (row.category_name?.trim()) {
        const { data: existing } = await supabase
          .from('product_categories')
          .select('id')
          .ilike('name', row.category_name.trim())
          .eq('type', type)
          .single()
        if (existing) {
          categoryId = existing.id
        } else {
          const { data: newCat } = await supabase
            .from('product_categories')
            .insert({ name: row.category_name.trim(), type })
            .select('id').single()
          categoryId = newCat?.id ?? null
        }
      }

      const payload = {
        name: row.name.trim(),
        sku: row.sku?.trim() || null,
        type,
        unit: row.unit?.trim() || null,
        packaging_desc: row.packaging_desc?.trim() || null,
        packaging_qty: row.packaging_qty ? parseFloat(row.packaging_qty) : null,
        price_excl_tax: row.price_excl_tax ? parseFloat(row.price_excl_tax) : null,
        min_stock: row.min_stock ? parseFloat(row.min_stock) : null,
        delivery_days: row.delivery_days ? parseInt(row.delivery_days) : null,
        purchase_url: row.purchase_url?.trim() || null,
        hotel_scope: (row.hotel_scope?.trim() || 'both') as 'mercure' | 'ibis' | 'both',
        supplier_id: supplierId,
        category_id: categoryId,
        is_active: true,
      }

      // Upsert on name + type
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('name', payload.name)
        .eq('type', type)
        .single()

      if (existing) {
        await supabase.from('products').update(payload).eq('id', existing.id)
        updated++
      } else {
        await supabase.from('products').insert(payload)
        created++
      }
    }

    return NextResponse.json({ created, updated, total: rows.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
