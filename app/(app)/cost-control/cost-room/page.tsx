import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { currentMonth, monthLabel, isoDate } from '@/lib/utils'

const CODE_TO_COL: Record<string, string> = {
  sgl: 'rooms_sold_sgl',
  dba: 'rooms_sold_dba',
  dbbz: 'rooms_sold_dbbz',
  twcz: 'rooms_sold_twcz',
  privm: 'rooms_sold_privm',
  dbl: 'rooms_sold_dbl',
  twi: 'rooms_sold_twi',
  han: 'rooms_sold_han',
}

function calcRoomsSold(
  typologies: { room_type: { code: string; hotel_id: string } | null }[],
  stats: Record<string, unknown>[]
): number {
  const byHotel = new Map<string, Set<string>>()
  for (const t of typologies) {
    const rt = t.room_type
    if (!rt) continue
    if (!byHotel.has(rt.hotel_id)) byHotel.set(rt.hotel_id, new Set())
    byHotel.get(rt.hotel_id)!.add(rt.code.toLowerCase())
  }
  let total = 0
  for (const stat of stats) {
    const codes = byHotel.get(stat.hotel_id as string)
    if (!codes) continue
    for (const code of codes) {
      const col = CODE_TO_COL[code]
      if (col) total += (stat[col] as number) ?? 0
    }
  }
  return total
}

export default async function CostRoomPage() {
  const supabase = await createClient()
  const month = currentMonth()
  const today = isoDate(new Date())

  const [{ data: products }, { data: stock }, { data: stats }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, unit, hotel_scope, room_typologies:product_room_typologies(room_type:room_types(code, hotel_id))')
      .eq('type', 'room')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('stock_months')
      .select('product_id, used')
      .eq('month', month),
    supabase
      .from('daily_stats')
      .select('hotel_id, rooms_sold_sgl, rooms_sold_dba, rooms_sold_dbbz, rooms_sold_twcz, rooms_sold_privm, rooms_sold_dbl, rooms_sold_twi, rooms_sold_han')
      .gte('stat_date', month)
      .lte('stat_date', today),
  ])

  const rows = (products ?? []).map((p: any) => {
    const used = stock?.find(s => s.product_id === p.id)?.used ?? 0
    const typologies = (p.room_typologies ?? []) as { room_type: { code: string; hotel_id: string } | null }[]
    const roomsSold = calcRoomsSold(typologies, (stats ?? []) as Record<string, unknown>[])
    const ratio = roomsSold > 0 ? used / roomsSold : null
    const assignedCodes = typologies
      .map(t => t.room_type?.code?.toUpperCase())
      .filter(Boolean)
      .join(', ')
    return { id: p.id as number, name: p.name as string, unit: p.unit as string, used, roomsSold, ratio, assignedCodes }
  })

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-[#3D1640]">Cost Room</h1>
        <p className="text-sm text-[#B0A5B4] mt-0.5">{monthLabel(month)} — Consommation par chambre vendue (MTD)</p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[#B0A5B4]">
            Aucun produit chambres actif.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-[#E5E2D8] p-5 space-y-3">
              <div>
                <p className="font-semibold text-[#3D1640] text-sm leading-tight">{r.name}</p>
                {r.assignedCodes && (
                  <p className="text-xs text-[#B0A5B4] mt-0.5">{r.assignedCodes}</p>
                )}
              </div>

              <div className="text-center py-2">
                {r.ratio !== null ? (
                  <>
                    <p className="text-3xl font-bold text-[#602460]">
                      {r.ratio.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#B0A5B4] mt-0.5">
                      {r.unit ?? 'unité'} / chambre vendue
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-[#C5C0B1]">—</p>
                )}
              </div>

              <div className="flex justify-between text-xs text-[#7B6B80] border-t border-[#F0EDE8] pt-3">
                <span>
                  <span className="font-medium text-[#3D1640]">{r.used}</span> {r.unit ?? ''} consommés
                </span>
                <span>
                  <span className="font-medium text-[#3D1640]">{r.roomsSold}</span> nuits vendues
                </span>
              </div>

              {r.assignedCodes === '' && (
                <p className="text-xs text-amber-500">Aucune chambre assignée</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
