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
      .from('duty_roster')
      .select('staff:staff_id(full_name, service), day_date, shift, value')
      .gte('day_date', startDate)
      .lte('day_date', endDate),
    supabase
      .from('menu_item_sales')
      .select('quantity, menu_item:menu_items(price_excl_tax)')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate),
  ])

  type RosterRow = { staff: { full_name: string; service: string } | null; day_date: string; shift: string; value: string }
  const rows = (rosters as unknown as RosterRow[]) ?? []

  const totalShifts = rows.length
  const uniqueDays = new Set(rows.map(r => r.day_date)).size

  const totalRevenue = (fbRevenue ?? []).reduce((sum, s) => {
    const price = (s.menu_item as { price_excl_tax?: number } | null)?.price_excl_tax ?? 0
    return sum + price * s.quantity
  }, 0)

  const byService: Record<string, { shifts: number; days: Set<string> }> = {}
  for (const r of rows) {
    const service = r.staff?.service ?? 'Non renseigné'
    if (!byService[service]) byService[service] = { shifts: 0, days: new Set() }
    byService[service].shifts++
    byService[service].days.add(r.day_date)
  }

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-[#3D1640]">Cost RH</h1>
        <p className="text-sm text-[#B0A5B4] mt-0.5">{monthLabel(month)} — Activité ressources humaines</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-xl font-bold text-[#602460]">{totalShifts}</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Shifts planifiés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-xl font-bold text-[#3D1640]">{uniqueDays}</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Jours actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-xl font-bold text-green-700">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">CA F&B HT</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Activité par service</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9F7F4] border-b border-[#E5E2D8]">
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Service</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Shifts</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#7B6B80] uppercase tracking-wider">Jours</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byService).length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-[#B0A5B4]">Aucune donnée RH ce mois.</td></tr>
              ) : Object.entries(byService)
                .sort(([, a], [, b]) => b.shifts - a.shifts)
                .map(([service, data]) => (
                  <tr key={service} className="border-b border-[#E5E2D8] hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3 text-[#3D1640]">{service}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#7B6B80]">{data.shifts}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#602460]">{data.days.size}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-[#B0A5B4] italic">
        Note : le calcul du coût RH (€) nécessite l&apos;ajout d&apos;un champ <code>hourly_rate</code> sur la table staff.
      </p>
    </div>
  )
}
