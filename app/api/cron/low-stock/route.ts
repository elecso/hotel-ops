import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLowStockDigest, type LowStockProduct } from '@/lib/resend'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, unit, min_stock, purchase_url, supplier:suppliers(name)')
    .eq('type', 'room')
    .eq('is_active', true)
    .not('min_stock', 'is', null)

  if (error || !products?.length) {
    return NextResponse.json({ sent: false, reason: error?.message ?? 'no products' })
  }

  const productIds = products.map((p: { id: number }) => p.id)

  const { data: stocks } = await supabase
    .from('stock_months')
    .select('product_id, opening_stock, bought, used')
    .eq('month', month)
    .in('product_id', productIds)

  const stockMap = new Map<number, number>()
  for (const s of stocks ?? []) {
    const current = (s.opening_stock ?? 0) + (s.bought ?? 0) - (s.used ?? 0)
    stockMap.set(s.product_id, current)
  }

  const lowStock: LowStockProduct[] = []
  for (const p of products) {
    const currentStock = stockMap.get(p.id) ?? 0
    if (currentStock < (p.min_stock ?? 0)) {
      lowStock.push({
        name: p.name,
        currentStock,
        minStock: p.min_stock,
        unit: p.unit ?? '',
        supplierName: (p.supplier as unknown as { name: string } | null)?.name ?? '',
        purchaseUrl: p.purchase_url ?? '',
      })
    }
  }

  if (lowStock.length === 0) {
    return NextResponse.json({ sent: false, reason: 'no low-stock products' })
  }

  await sendLowStockDigest(lowStock)

  return NextResponse.json({ sent: true, count: lowStock.length })
}
