import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { currentMonth, monthLabel, isoDate, formatCurrency } from '@/lib/utils'

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

export default async function CostRoomPage() {
  const supabase = await createAdminClient()
  const month = currentMonth()
  const today = isoDate(new Date())

  const [
    { data: products },
    { data: stock },
    { data: stats },
    { data: allRoomTypes },
    { data: typologies },
  ] = await Promise.all([
    supabase.from('products').select('id, name, unit, packaging_qty, price_excl_tax, hotel_scope').eq('type', 'room').eq('is_active', true).order('name'),
    supabase.from('stock_months').select('product_id, used').eq('month', month),
    supabase.from('daily_stats')
      .select('hotel_id, rooms_sold_sgl, rooms_sold_dba, rooms_sold_dbbz, rooms_sold_twcz, rooms_sold_privm, rooms_sold_dbl, rooms_sold_twi, rooms_sold_han')
      .gte('stat_date', month)
      .lte('stat_date', today),
    supabase.from('room_types').select('id, code, hotel_id'),
    supabase.from('product_room_typologies').select('product_id, room_type_id'),
  ])

  const rtCodeMap = new Map<number, string>()
  for (const rt of (allRoomTypes ?? [])) {
    rtCodeMap.set(rt.id, rt.code.toLowerCase())
  }

  const rows = (products ?? []).map((p: any) => {
    const usedBoxes = stock?.find((s: any) => s.product_id === p.id)?.used ?? 0
    const packQty: number = p.packaging_qty ?? 1
    const usedUnits = usedBoxes * packQty
    const pricePerUnit: number = p.price_excl_tax ? p.price_excl_tax / packQty : 0
    const totalCost = usedUnits * pricePerUnit

    const assignedCodes = new Set<string>()
    for (const t of (typologies ?? []).filter((t: any) => t.product_id === p.id)) {
      const code = rtCodeMap.get(t.room_type_id)
      if (code) assignedCodes.add(code)
    }

    let roomsSold = 0
    for (const stat of (stats ?? [])) {
      for (const code of assignedCodes) {
        const col = CODE_TO_COL[code]
        if (col) roomsSold += (stat as any)[col] ?? 0
      }
    }

    const ratio = roomsSold > 0 ? usedUnits / roomsSold : null
    const codesLabel = [...assignedCodes].map(c => c.toUpperCase()).sort().join(', ')

    return {
      id: p.id as number,
      name: p.name as string,
      unit: (p.unit as string) ?? '',
      packQty,
      usedBoxes,
      usedUnits,
      totalCost,
      roomsSold,
      ratio,
      codesLabel,
      noTypes: assignedCodes.size === 0,
    }
  })

  const totalCostAll = rows.reduce((s, r) => s + r.totalCost, 0)

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-[#3D1640]">Cost Room</h1>
        <p className="text-sm text-[#B0A5B4] mt-0.5">{monthLabel(month)} — Consommation par chambre vendue (MTD)</p>
      </div>

      <Card>
        <CardContent className="py-5 text-center">
          <p className="text-3xl font-bold text-[#602460]">{formatCurrency(totalCostAll)}</p>
          <p className="text-xs text-[#B0A5B4] mt-1 uppercase tracking-wide">Coût total consommé ce mois</p>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[#B0A5B4]">
            Aucun produit chambres actif.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(r => (
            <div
              key={r.id}
              className="group bg-white rounded-xl border border-[#E5E2D8] p-5 space-y-3 transition-all duration-200 hover:shadow-md hover:border-[#602460]/30 hover:-translate-y-0.5 cursor-default"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[#3D1640] text-sm leading-tight truncate">{r.name}</p>
                  {r.codesLabel && (
                    <p className="text-xs text-[#B0A5B4] mt-0.5">{r.codesLabel}</p>
                  )}
                </div>
                {r.totalCost > 0 && (
                  <span className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#602460]/10 text-[#602460] group-hover:bg-[#602460] group-hover:text-white transition-colors">
                    {formatCurrency(r.totalCost)}
                  </span>
                )}
              </div>

              {/* Ratio */}
              <div className="text-center py-3 rounded-lg bg-[#F9F7F4] group-hover:bg-[#602460]/5 transition-colors">
                {r.noTypes ? (
                  <p className="text-xs text-amber-500 font-medium">Aucune chambre assignée</p>
                ) : r.ratio !== null ? (
                  <>
                    <p className="text-3xl font-bold text-[#602460] group-hover:scale-105 transition-transform inline-block">
                      {r.ratio.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#B0A5B4] mt-0.5">{r.unit || 'unité'} / chambre vendue</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-[#C5C0B1]">—</p>
                    <p className="text-xs text-[#B0A5B4] mt-0.5">0 chambre vendue ce mois</p>
                  </>
                )}
              </div>

              {/* Footer stats */}
              <div className="flex justify-between text-xs text-[#7B6B80] border-t border-[#F0EDE8] pt-3">
                <span>
                  <span className="font-medium text-[#3D1640]">{r.usedUnits}</span>{r.unit ? ` ${r.unit}` : ''}
                  {r.packQty > 1 && (
                    <span className="text-[#C5C0B1] ml-1">({r.usedBoxes} cdt)</span>
                  )}
                </span>
                <span>
                  <span className="font-medium text-[#3D1640]">{r.roomsSold}</span> nuits vendues
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
