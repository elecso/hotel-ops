'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { monthLabel } from '@/lib/utils'
import type { Budget, HotelAllStars } from '@/lib/types'

interface DailyStatMTD { hotel_id: string; occupancy_pct: number | null; adr: number | null; rps: number | null }
interface ForecastRow { hotel_id: string; occupancy_pct: number | null }

interface Props {
  dailyStatsMTD: DailyStatMTD[]
  forecast: ForecastRow[]
  budgetRows: Budget[]
  allStarsRows: HotelAllStars[]
  currentMonth: string
  isManager: boolean
}

const HOTELS = [
  { id: 'mercure', label: 'Mercure', color: '#602460' },
  { id: 'ibis', label: 'Ibis', color: '#E8003D' },
]
const RPS_OBJ: Record<string, number> = { mercure: 86.5, ibis: 85 }
const ALL_STARS_MTD_OBJ: Record<string, number> = { mercure: 107, ibis: 91 }

function avg(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length
}
function fmt(val: number | null, dec = 1, suf = '') { return val == null ? '—' : `${val.toFixed(dec)}${suf}` }

function KpiTable({ rows }: { rows: { label: string; mercure: string; ibis: string; objM?: string; objI?: string }[] }) {
  return (
    <div className="divide-y divide-[#E5E2D8]">
      <div className="grid grid-cols-5 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[#B0A5B4]">
        <span></span>
        <span className="text-center">Mercure</span>
        <span className="text-center">Obj.</span>
        <span className="text-center">Ibis</span>
        <span className="text-center">Obj.</span>
      </div>
      {rows.map(r => (
        <div key={r.label} className="grid grid-cols-5 items-center py-2 text-sm">
          <span className="text-[#3D1640] font-medium">{r.label}</span>
          <span className="text-center font-mono font-semibold text-[#602460]">{r.mercure}</span>
          <span className="text-center font-mono text-[#B0A5B4] text-xs">{r.objM ?? '—'}</span>
          <span className="text-center font-mono font-semibold text-[#E8003D]">{r.ibis}</span>
          <span className="text-center font-mono text-[#B0A5B4] text-xs">{r.objI ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

export function StatisticsRoomsClient({ dailyStatsMTD, forecast, budgetRows: initBudget, allStarsRows: initStars, currentMonth, isManager }: Props) {
  const [budgetRows, setBudgetRows] = useState<Budget[]>(initBudget)
  const [allStarsRows, setAllStarsRows] = useState<HotelAllStars[]>(initStars)
  const [savingBudget, setSavingBudget] = useState<string | null>(null)
  const [savingStars, setSavingStars] = useState<string | null>(null)
  const supabase = createClient()

  const byHotel = (hid: string) => dailyStatsMTD.filter(d => d.hotel_id === hid)
  const fcByHotel = (hid: string) => forecast.filter(f => f.hotel_id === hid)
  const getBudget = (hid: string, m: string) => budgetRows.find(b => b.hotel_id === hid && b.month === m)
  const getStars = (hid: string) => allStarsRows.find(a => a.hotel_id === hid && a.month === currentMonth)

  const year = parseInt(currentMonth.slice(0, 4))
  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`)

  const updateBudget = (hid: string, m: string, field: 'occupancy_budget' | 'adr_budget', val: string) => {
    const num = val === '' ? null : parseFloat(val)
    setBudgetRows(prev => {
      const exists = prev.find(b => b.hotel_id === hid && b.month === m)
      if (exists) return prev.map(b => b.hotel_id === hid && b.month === m ? { ...b, [field]: num } : b)
      return [...prev, { id: 0, hotel_id: hid, month: m, occupancy_budget: null, adr_budget: null, [field]: num }]
    })
  }

  const saveBudget = async (hid: string, m: string) => {
    setSavingBudget(`${hid}-${m}`)
    const row = getBudget(hid, m)
    await supabase.from('budget').upsert(
      { hotel_id: hid, month: m, occupancy_budget: row?.occupancy_budget ?? null, adr_budget: row?.adr_budget ?? null },
      { onConflict: 'hotel_id,month' }
    )
    setSavingBudget(null)
  }

  const updateStars = (hid: string, field: 'all_stars_mtd' | 'all_stars_ytd', val: string) => {
    const num = val === '' ? null : parseFloat(val)
    setAllStarsRows(prev => {
      const exists = prev.find(a => a.hotel_id === hid && a.month === currentMonth)
      if (exists) return prev.map(a => a.hotel_id === hid && a.month === currentMonth ? { ...a, [field]: num } : a)
      return [...prev, { id: 0, hotel_id: hid, month: currentMonth, all_stars_mtd: null, all_stars_ytd: null, [field]: num }]
    })
  }

  const saveStars = async (hid: string) => {
    setSavingStars(hid)
    const row = getStars(hid)
    await supabase.from('hotel_all_stars').upsert(
      { hotel_id: hid, month: currentMonth, all_stars_mtd: row?.all_stars_mtd ?? null, all_stars_ytd: row?.all_stars_ytd ?? null },
      { onConflict: 'hotel_id,month' }
    )
    setSavingStars(null)
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* MTD KPIs */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B0A5B4] mb-3">Résultats MTD</p>
        <Card><CardContent className="p-4">
          <KpiTable rows={[
            {
              label: 'Taux d\'occupation',
              mercure: fmt(avg(byHotel('mercure').map(d => d.occupancy_pct)), 1, ' %'),
              ibis: fmt(avg(byHotel('ibis').map(d => d.occupancy_pct)), 1, ' %'),
              objM: fmt(getBudget('mercure', currentMonth)?.occupancy_budget ?? null, 1, ' %'),
              objI: fmt(getBudget('ibis', currentMonth)?.occupancy_budget ?? null, 1, ' %'),
            },
            {
              label: 'ADR',
              mercure: fmt(avg(byHotel('mercure').map(d => d.adr)), 2, ' €'),
              ibis: fmt(avg(byHotel('ibis').map(d => d.adr)), 2, ' €'),
              objM: fmt(getBudget('mercure', currentMonth)?.adr_budget ?? null, 2, ' €'),
              objI: fmt(getBudget('ibis', currentMonth)?.adr_budget ?? null, 2, ' €'),
            },
            {
              label: 'RPS',
              mercure: fmt(avg(byHotel('mercure').map(d => d.rps)), 2, ' €'),
              ibis: fmt(avg(byHotel('ibis').map(d => d.rps)), 2, ' €'),
              objM: `${RPS_OBJ['mercure']} €`,
              objI: `${RPS_OBJ['ibis']} €`,
            },
          ]} />
        </CardContent></Card>
      </section>

      {/* Forecast */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B0A5B4] mb-3">Prévisions d'occupation (moyenne)</p>
        <div className="grid grid-cols-2 gap-4">
          {HOTELS.map(h => (
            <Card key={h.id}><CardContent className="p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: h.color }}>{h.label}</p>
              <p className="text-3xl font-bold font-mono" style={{ color: h.color }}>
                {fmt(avg(fcByHotel(h.id).map(f => f.occupancy_pct)), 1, ' %')}
              </p>
            </CardContent></Card>
          ))}
        </div>
      </section>

      {/* Budget table */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B0A5B4] mb-3">Budget annuel {year}</p>
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F4F2ED' }}>
                  <th className="text-left px-4 py-2.5 font-semibold text-[#3D1640]">Mois</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[#602460]">Occ. M (%)</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[#602460]">ADR M (€)</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[#E8003D]">Occ. I (%)</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[#E8003D]">ADR I (€)</th>
                  {isManager && <th className="px-3 py-2.5 w-16"></th>}
                </tr>
              </thead>
              <tbody>
                {yearMonths.map(m => (
                  <tr key={m} className={`border-t border-[#E5E2D8] ${m === currentMonth ? 'bg-purple-50' : ''}`}>
                    <td className="px-4 py-2 font-medium text-[#3D1640]">{monthLabel(m)}</td>
                    {(['mercure', 'ibis'] as const).flatMap(hid => {
                      const row = getBudget(hid, m)
                      return [
                        <td key={`${hid}-occ`} className="px-2 py-1.5 text-center">
                          {isManager
                            ? <Input type="number" step="0.1" className="h-7 w-20 text-xs text-center mx-auto" value={row?.occupancy_budget ?? ''} onChange={e => updateBudget(hid, m, 'occupancy_budget', e.target.value)} />
                            : <span className="font-mono text-sm">{fmt(row?.occupancy_budget ?? null, 1)}</span>}
                        </td>,
                        <td key={`${hid}-adr`} className="px-2 py-1.5 text-center">
                          {isManager
                            ? <Input type="number" step="0.01" className="h-7 w-20 text-xs text-center mx-auto" value={row?.adr_budget ?? ''} onChange={e => updateBudget(hid, m, 'adr_budget', e.target.value)} />
                            : <span className="font-mono text-sm">{fmt(row?.adr_budget ?? null, 2)}</span>}
                        </td>,
                      ]
                    })}
                    {isManager && (
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          {(['mercure', 'ibis'] as const).map(h => (
                            <Button key={h} size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={savingBudget === `${h}-${m}`} onClick={() => saveBudget(h, m)}>
                              <Check size={12} />
                            </Button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      </section>

      {/* All Stars */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B0A5B4] mb-3">All Stars</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HOTELS.map(h => {
            const row = getStars(h.id)
            return (
              <Card key={h.id}><CardContent className="p-4">
                <p className="text-sm font-semibold mb-3" style={{ color: h.color }}>{h.label}</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[#B0A5B4] mb-1">MTD — objectif {ALL_STARS_MTD_OBJ[h.id]}/mois</p>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.1" className="h-8 w-28 text-sm" value={row?.all_stars_mtd ?? ''} onChange={e => updateStars(h.id, 'all_stars_mtd', e.target.value)} placeholder="—" disabled={!isManager} />
                      <span className="text-xs text-[#B0A5B4]">/ {ALL_STARS_MTD_OBJ[h.id]}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[#B0A5B4] mb-1">YTD</p>
                    <Input type="number" step="0.1" className="h-8 w-28 text-sm" value={row?.all_stars_ytd ?? ''} onChange={e => updateStars(h.id, 'all_stars_ytd', e.target.value)} placeholder="—" disabled={!isManager} />
                  </div>
                  {isManager && (
                    <Button size="sm" onClick={() => saveStars(h.id)} disabled={savingStars === h.id} className="w-full">
                      {savingStars === h.id ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                  )}
                </div>
              </CardContent></Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
