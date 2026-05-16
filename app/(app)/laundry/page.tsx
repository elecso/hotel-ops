import { createClient } from '@/lib/supabase/server'
import { isoDate } from '@/lib/utils'
import { LaundryMatrixClient } from './LaundryMatrixClient'

export default async function LaundryPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const supabase = await createClient()

  const today = isoDate(new Date())
  const weekStart = week ?? today

  const [{ data: products }, { data: stockData }] = await Promise.all([
    supabase
      .from('products')
      .select('*, category:product_categories(*), supplier:suppliers(*), room_typologies:product_room_typologies(room_type_id)')
      .eq('type', 'laundry')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('stock_months')
      .select('*')
      .eq('month', `${today.slice(0, 7)}-01`),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (products ?? []).map((p: any) => {
    const stock = stockData?.find((s: { product_id: number }) => s.product_id === p.id) ?? null
    const theoretical = (stock?.opening_stock ?? 0) + (stock?.bought ?? 0) - (stock?.used ?? 0)
    return { product: p, stock, theoretical }
  })

  return <LaundryMatrixClient initialProducts={rows} weekStart={weekStart} />
}
