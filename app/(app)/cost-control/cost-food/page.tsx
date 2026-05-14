import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency, currentMonth, monthLabel } from '@/lib/utils'

export default async function CostFoodPage() {
  const supabase = await createClient()
  const month = currentMonth()
  const startDate = month.substring(0, 7) + '-01'
  const endDate = new Date(parseInt(month.substring(0, 4)), parseInt(month.substring(5, 7)), 0)
    .toISOString().split('T')[0]

  const [{ data: products }, { data: stock }, { data: sales }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, price_excl_tax, unit')
      .eq('type', 'food')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('stock_months')
      .select('product_id, bought, used, opening_stock')
      .eq('month', month),
    supabase
      .from('menu_item_sales')
      .select('quantity, menu_item:menu_items(price_excl_tax, name)')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate),
  ])

  const totalPurchased = (products ?? []).reduce((sum, p) => {
    const s = stock?.find(s => s.product_id === p.id)
    return sum + (s?.bought ?? 0) * (p.price_excl_tax ?? 0)
  }, 0)

  const totalRevenue = (sales ?? []).reduce((sum, s) => {
    const price = (s.menu_item as { price_excl_tax?: number } | null)?.price_excl_tax ?? 0
    return sum + price * s.quantity
  }, 0)

  const foodCostRatio = totalRevenue > 0 ? (totalPurchased / totalRevenue) * 100 : 0

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-[#3D1640]">Cost Food</h1>
        <p className="text-sm text-[#B0A5B4] mt-0.5">{monthLabel(month)} — Ratio coût matières alimentaires</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-2xl font-bold text-[#602460]">{formatCurrency(totalPurchased)}</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Achats alimentaires HT</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-2xl font-bold text-green-700">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">CA F&B HT</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className={`text-2xl font-bold ${foodCostRatio > 35 ? 'text-red-600' : foodCostRatio > 28 ? 'text-amber-600' : 'text-green-700'}`}>
              {foodCostRatio.toFixed(1)}%
            </p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Food Cost Ratio</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Détail achats alimentaires</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9F7F4] border-b border-[#E5E2D8]">
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Produit</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Acheté</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Prix HT</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Coût</th>
              </tr>
            </thead>
            <tbody>
              {(products ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[#B0A5B4]">Aucun produit alimentaire.</td></tr>
              ) : (products ?? []).map(p => {
                const s = stock?.find(s => s.product_id === p.id)
                const bought = s?.bought ?? 0
                const cost = bought * (p.price_excl_tax ?? 0)
                return (
                  <tr key={p.id} className="border-b border-[#E5E2D8] hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3 text-[#3D1640] font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#7B6B80]">{bought} {p.unit}</td>
                    <td className="px-4 py-3 text-right font-mono text-sky-700">{p.price_excl_tax ? formatCurrency(p.price_excl_tax) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#602460]">{formatCurrency(cost)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
