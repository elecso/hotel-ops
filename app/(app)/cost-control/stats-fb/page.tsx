import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

export default async function StatsFbPage() {
  const supabase = await createClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [{ data: sales }, { data: imports }] = await Promise.all([
    supabase
      .from('menu_item_sales')
      .select('quantity, menu_item:menu_items(price_excl_tax, name, outlet)')
      .gte('sale_date', firstDay)
      .lte('sale_date', lastDay),
    supabase
      .from('fb_imports')
      .select('import_date')
      .gte('import_date', firstDay)
      .lte('import_date', lastDay)
      .order('import_date', { ascending: false }),
  ])

  const totalRevenue = (sales ?? []).reduce((sum, s) => {
    const price = (s.menu_item as { price_excl_tax?: number } | null)?.price_excl_tax ?? 0
    return sum + price * s.quantity
  }, 0)

  const byOutlet: Record<string, number> = {}
  for (const s of sales ?? []) {
    const outlet = (s.menu_item as { outlet?: string } | null)?.outlet ?? 'Autre'
    const price = (s.menu_item as { price_excl_tax?: number } | null)?.price_excl_tax ?? 0
    byOutlet[outlet] = (byOutlet[outlet] ?? 0) + price * s.quantity
  }

  const OUTLET_LABELS: Record<string, string> = {
    breakfast_mercure: 'Petit-déj Mercure', breakfast_ibis: 'Petit-déj Ibis',
    lunch: 'Déjeuner', dinner: 'Dîner', room_service: 'Room Service',
    banqueting_lunch: 'Banquet déjeuner', banqueting_dinner: 'Banquet dîner',
  }

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-[#3D1640]">Stats F&B</h1>
        <p className="text-sm text-[#B0A5B4] mt-0.5">Revenus du mois en cours</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-2xl font-bold text-[#602460]">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Chiffre d&apos;affaires HT</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-2xl font-bold text-[#3D1640]">{(sales ?? []).reduce((s, r) => s + r.quantity, 0)}</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Couverts / articles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-2xl font-bold text-[#3D1640]">{(imports ?? []).length}</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Imports F&B ce mois</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Revenus par point de vente</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9F7F4] border-b border-[#E5E2D8]">
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Point de vente</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">CA HT</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byOutlet).length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-8 text-center text-[#B0A5B4]">Aucune vente enregistrée ce mois.</td></tr>
              ) : Object.entries(byOutlet)
                .sort(([, a], [, b]) => b - a)
                .map(([outlet, rev]) => (
                  <tr key={outlet} className="border-b border-[#E5E2D8] hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3 text-[#3D1640]">{OUTLET_LABELS[outlet] ?? outlet}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#602460]">{formatCurrency(rev)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
