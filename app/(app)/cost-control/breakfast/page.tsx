import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency, currentMonth, monthLabel } from '@/lib/utils'

export default async function CostBreakfastPage() {
  const supabase = await createClient()
  const month = currentMonth()

  const [{ data: products }, { data: stock }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, price_excl_tax, unit, supplier:suppliers(name)')
      .eq('type', 'breakfast')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('stock_months')
      .select('product_id, bought, used, opening_stock')
      .eq('month', month),
  ])

  const totalCost = (products ?? []).reduce((sum, p) => {
    const s = stock?.find(s => s.product_id === p.id)
    return sum + (s?.used ?? 0) * (p.price_excl_tax ?? 0)
  }, 0)

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-[#3D1640]">Cost Petit Déjeuner</h1>
        <p className="text-sm text-[#B0A5B4] mt-0.5">{monthLabel(month)} — Coût matières petit déjeuner</p>
      </div>

      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-3xl font-bold text-[#602460]">{formatCurrency(totalCost)}</p>
          <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Coût total HT (produits utilisés)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Détail par produit</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9F7F4] border-b border-[#E5E2D8]">
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Produit</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Fournisseur</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Utilisé</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Prix HT</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Coût</th>
              </tr>
            </thead>
            <tbody>
              {(products ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[#B0A5B4]">
                  Aucun produit petit déjeuner. Ajoutez-en via Inventaire → Petit déjeuner.
                </td></tr>
              ) : (products ?? []).map(p => {
                const s = stock?.find(s => s.product_id === p.id)
                const used = s?.used ?? 0
                const cost = used * (p.price_excl_tax ?? 0)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const supplier = (p as any).supplier?.name as string | undefined
                return (
                  <tr key={p.id} className="border-b border-[#E5E2D8] hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3 text-[#3D1640] font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-[#7B6B80]">{supplier ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#7B6B80]">{used} {p.unit}</td>
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
