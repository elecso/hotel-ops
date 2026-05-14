import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency, currentMonth, monthLabel } from '@/lib/utils'

export default async function CostRhPage() {
  const supabase = await createClient()
  const month = currentMonth()
  const startDate = month.substring(0, 7) + '-01'
  const endDate = new Date(parseInt(month.substring(0, 4)), parseInt(month.substring(5, 7)), 0)
    .toISOString().split('T')[0]

  const [{ data: rosters }, { data: fbRevenue }] = await Promise.all([
    supabase
      .from('duty_rosters')
      .select('staff:staff_id(full_name, hourly_rate, department), date, hours')
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('menu_item_sales')
      .select('quantity, menu_item:menu_items(price_excl_tax)')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate),
  ])

  type RosterRow = { staff: { full_name: string; hourly_rate: number; department: string } | null; date: string; hours: number }
  const rows = rosters as RosterRow[] ?? []

  const totalHours = rows.reduce((s, r) => s + (r.hours ?? 0), 0)
  const totalCost = rows.reduce((s, r) => {
    const rate = r.staff?.hourly_rate ?? 0
    return s + (r.hours ?? 0) * rate
  }, 0)

  const totalRevenue = (fbRevenue ?? []).reduce((sum, s) => {
    const price = (s.menu_item as { price_excl_tax?: number } | null)?.price_excl_tax ?? 0
    return sum + price * s.quantity
  }, 0)

  const rhRatio = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0

  const byDept: Record<string, { hours: number; cost: number }> = {}
  for (const r of rows) {
    const dept = r.staff?.department ?? 'Autre'
    if (!byDept[dept]) byDept[dept] = { hours: 0, cost: 0 }
    byDept[dept].hours += r.hours ?? 0
    byDept[dept].cost += (r.hours ?? 0) * (r.staff?.hourly_rate ?? 0)
  }

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-[#3D1640]">Cost RH</h1>
        <p className="text-sm text-[#B0A5B4] mt-0.5">{monthLabel(month)} — Coûts ressources humaines</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-xl font-bold text-[#602460]">{formatCurrency(totalCost)}</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Coût RH total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-xl font-bold text-[#3D1640]">{totalHours.toFixed(1)}h</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Heures travaillées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-xl font-bold text-green-700">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">CA F&B HT</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className={`text-xl font-bold ${rhRatio > 40 ? 'text-red-600' : rhRatio > 30 ? 'text-amber-600' : 'text-green-700'}`}>
              {rhRatio.toFixed(1)}%
            </p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Ratio RH / CA</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Coûts par département</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9F7F4] border-b border-[#E5E2D8]">
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Département</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Heures</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Coût</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byDept).length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-[#B0A5B4]">Aucune donnée RH ce mois.</td></tr>
              ) : Object.entries(byDept)
                .sort(([, a], [, b]) => b.cost - a.cost)
                .map(([dept, data]) => (
                  <tr key={dept} className="border-b border-[#E5E2D8] hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3 text-[#3D1640]">{dept}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#7B6B80]">{data.hours.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#602460]">{formatCurrency(data.cost)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
