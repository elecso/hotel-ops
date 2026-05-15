'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Pencil, Check, X } from 'lucide-react'
import type { Product, StockMonth } from '@/lib/types'

interface ProductRow {
  product: Product
  stock: StockMonth | null
  theoretical: number
}

interface Props {
  initialProducts: ProductRow[]
  weekStart: string
}

interface DeliveryWindow {
  deliveryDay: string
  deliveryLabel: string
  coverDays: string[]
  coverLabel: string
}

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function dayLabel(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function getWeekStart(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function buildDeliveryWindows(weekMon: string): DeliveryWindow[] {
  return [
    {
      deliveryDay: weekMon,
      deliveryLabel: dayLabel(weekMon),
      coverDays: [addDays(weekMon, 1), addDays(weekMon, 2)],
      coverLabel: `${dayLabel(addDays(weekMon, 1))} + ${dayLabel(addDays(weekMon, 2))}`,
    },
    {
      deliveryDay: addDays(weekMon, 2),
      deliveryLabel: dayLabel(addDays(weekMon, 2)),
      coverDays: [addDays(weekMon, 3), addDays(weekMon, 4)],
      coverLabel: `${dayLabel(addDays(weekMon, 3))} + ${dayLabel(addDays(weekMon, 4))}`,
    },
    {
      deliveryDay: addDays(weekMon, 4),
      deliveryLabel: dayLabel(addDays(weekMon, 4)),
      coverDays: [addDays(weekMon, 5), addDays(weekMon, 6), addDays(weekMon, 7)],
      coverLabel: `${dayLabel(addDays(weekMon, 5))} + ${dayLabel(addDays(weekMon, 6))} + ${dayLabel(addDays(weekMon, 7))}`,
    },
  ]
}

function DepartureCell({
  date, hotel, value, onChange,
}: { date: string; hotel: string; value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const supabase = createClient()

  useEffect(() => { setDraft(String(value)) }, [value])

  const save = async () => {
    const n = parseInt(draft)
    if (!isNaN(n)) {
      await supabase.from('forecast_occupancy').upsert(
        { forecast_date: date, hotel_id: hotel, departures: n },
        { onConflict: 'forecast_date,hotel_id' }
      )
      onChange(n)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-center">
        <input
          className="w-16 h-7 text-center text-xs border border-[#602460]/40 rounded px-1 font-mono"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus
          type="number"
          min="0"
        />
        <button onClick={save} className="text-green-600"><Check size={12} /></button>
        <button onClick={() => setEditing(false)} className="text-red-400"><X size={12} /></button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      className="flex items-center gap-1 justify-center text-sm font-mono font-bold text-[#3D1640] hover:text-[#602460] group"
    >
      {value}
      <Pencil size={10} className="opacity-0 group-hover:opacity-40 transition-opacity" />
    </button>
  )
}

export function LaundryMatrixClient({ initialProducts, weekStart: initialWeek }: Props) {
  const [hotel, setHotel] = useState<'mercure' | 'ibis'>('mercure')
  const [weekMon, setWeekMon] = useState(getWeekStart(initialWeek))
  const [departures, setDepartures] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const windows = buildDeliveryWindows(weekMon)
  const allDates = Array.from(new Set(windows.flatMap(w => w.coverDays)))

  const filteredProducts = initialProducts.filter(r => {
    const scope = r.product.hotel_scope ?? 'both'
    if (hotel === 'mercure' && scope === 'ibis') return false
    if (hotel === 'ibis' && scope === 'mercure') return false
    return true
  })

  const loadDepartures = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('forecast_occupancy')
      .select('forecast_date, departures')
      .eq('hotel_id', hotel)
      .in('forecast_date', allDates)
    const map: Record<string, number> = {}
    for (const d of allDates) map[d] = 0
    for (const row of data ?? []) {
      if (row.departures != null) map[row.forecast_date] = row.departures
    }
    setDepartures(map)
    setLoading(false)
  }, [hotel, weekMon]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadDepartures() }, [loadDepartures])

  const navWeek = (delta: number) => {
    const d = new Date(weekMon + 'T12:00:00')
    d.setDate(d.getDate() + delta * 7)
    setWeekMon(d.toISOString().slice(0, 10))
  }

  const totalDeps = (win: DeliveryWindow) =>
    win.coverDays.reduce((s, d) => s + (departures[d] ?? 0), 0)

  const weekEndLabel = dayLabel(addDays(weekMon, 6))

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-widest font-medium text-[#B0A5B4] mb-1">Blanchisserie</p>
        <h2 className="text-2xl font-bold text-[#602460]">Matrice de commande</h2>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Hotel selector */}
        <div className="flex rounded-lg border border-[#E5E2D8] overflow-hidden bg-white">
          {(['mercure', 'ibis'] as const).map(h => (
            <button
              key={h}
              onClick={() => setHotel(h)}
              className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
                hotel === h
                  ? 'bg-[#602460] text-white'
                  : 'text-[#7B6B80] hover:bg-[#F4F2ED]'
              }`}
            >
              {h.charAt(0).toUpperCase() + h.slice(1)}
            </button>
          ))}
        </div>

        {/* Week navigator */}
        <div className="flex items-center gap-2 bg-white border border-[#E5E2D8] rounded-lg px-3 py-2">
          <button onClick={() => navWeek(-1)} className="text-[#B0A5B4] hover:text-[#602460] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-[#3D1640] min-w-52 text-center">
            {dayLabel(weekMon)} — {weekEndLabel}
          </span>
          <button onClick={() => navWeek(1)} className="text-[#B0A5B4] hover:text-[#602460] transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {loading && <span className="text-sm text-[#B0A5B4]">Chargement…</span>}
      </div>

      {/* Matrix table */}
      <div className="bg-white rounded-xl border border-[#E5E2D8] overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F4F2ED] border-b border-[#E5E2D8]">
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#7B6B80] w-48">Produit</th>
              <th className="text-center px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-[#7B6B80] w-24">Stock actuel</th>
              {windows.map(win => (
                <th key={win.deliveryDay} className="text-center px-3 py-2 min-w-36">
                  <div className="text-[11px] font-bold text-[#602460] capitalize">{win.deliveryLabel}</div>
                  <div className="text-[10px] text-[#B0A5B4] mt-0.5">{win.coverLabel}</div>
                </th>
              ))}
            </tr>

            {/* Departure counts row */}
            <tr className="border-b-2 border-[#E5E2D8] bg-sky-50/50">
              <td className="px-4 py-2 text-[11px] font-semibold text-[#7B6B80]">Départs couverts</td>
              <td />
              {windows.map(win => {
                const total = totalDeps(win)
                return (
                  <td key={win.deliveryDay} className="px-3 py-2 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      {win.coverDays.map(d => (
                        <DepartureCell
                          key={d}
                          date={d}
                          hotel={hotel}
                          value={departures[d] ?? 0}
                          onChange={v => setDepartures(prev => ({ ...prev, [d]: v }))}
                        />
                      ))}
                      <div className="text-[10px] text-sky-700 font-bold border-t border-sky-200 pt-1 w-full text-center">
                        Total: {total}
                      </div>
                    </div>
                  </td>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-sm text-[#B0A5B4]">
                  Aucun produit blanchisserie pour cet hôtel.
                </td>
              </tr>
            )}
            {filteredProducts.map(({ product, theoretical }) => (
              <tr key={product.id} className="border-b border-[#F4F2ED] hover:bg-[#F9F7F4] transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-[#3D1640]">{product.name}</p>
                  {product.coefficient != null && (
                    <p className="text-[11px] text-[#B0A5B4] mt-0.5">Coeff: ×{product.coefficient}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="font-mono text-sm font-bold text-[#602460]">{theoretical}</span>
                </td>
                {windows.map(win => {
                  const total = totalDeps(win)
                  const coeff = product.coefficient ?? 1
                  const qty = Math.ceil(total * coeff)
                  const net = Math.max(0, qty - theoretical)
                  return (
                    <td key={win.deliveryDay} className="px-3 py-3 text-center">
                      <div className="space-y-0.5">
                        <div className="font-mono text-sm font-bold text-[#3D1640]">{qty}</div>
                        {net > 0 && (
                          <div className="text-[10px] text-amber-600 font-semibold">+{net} à cmd.</div>
                        )}
                        {net === 0 && theoretical > 0 && (
                          <div className="text-[10px] text-green-600">Stock OK</div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[#B0A5B4]">
        Livraison lundi → couvre mardi + mercredi · Livraison mercredi → couvre jeudi + vendredi · Livraison vendredi → couvre samedi + dimanche + lundi suivant.
        Cliquer sur un nombre de départs pour le modifier.
      </p>
    </div>
  )
}
