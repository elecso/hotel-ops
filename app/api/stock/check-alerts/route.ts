import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
// import { sendStockAlert } from '@/lib/resend'
import { currentMonth } from '@/lib/utils'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(_req: NextRequest) {
  try {
    const supabase = getSupabase()
    const month = currentMonth()

    const { data: stockRows } = await supabase
      .from('stock_months')
      .select(`
        *,
        product:products(
          id, name, min_stock, purchase_url, unit, delivery_days,
          supplier:suppliers(name)
        )
      `)
      .eq('month', month)

    if (!stockRows) return NextResponse.json({ checked: 0, alerts: 0 })

    let alerts = 0
    for (const row of stockRows) {
      const theoretical = (row.opening_stock ?? 0) + (row.bought ?? 0) - (row.used ?? 0)
      const minStock = row.product?.min_stock ?? 0

      if (minStock > 0 && theoretical < minStock) {
        try {
          const { sendStockAlert } = await import('@/lib/resend')
          await sendStockAlert({
            productName: row.product?.name ?? 'Produit inconnu',
            currentStock: theoretical,
            minStock,
            supplierName: row.product?.supplier?.name ?? '—',
            deliveryDays: row.product?.delivery_days ?? 0,
            purchaseUrl: row.product?.purchase_url ?? '',
            unit: row.product?.unit ?? 'unité',
          })
          alerts++
        } catch (emailErr) {
          console.error('Failed to send alert for', row.product?.name, emailErr)
        }
      }
    }

    return NextResponse.json({ checked: stockRows.length, alerts })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
