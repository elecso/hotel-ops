'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, Star, Users, Target } from 'lucide-react'

interface HotelStats {
  avgOccupancy: number | null
  target: number
  avgRps: number | null
  totalAllStars: number | null
  daysWithData: number
}

interface Props {
  month: string
  mercure: HotelStats
  ibis: HotelStats
  isManager: boolean
  today: string
  userId: string
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent: string
  highlight?: boolean
}) {
  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{
        background: highlight ? accent : '#FAFAF8',
        border: `1px solid ${highlight ? accent : '#E5E2D8'}`,
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: highlight ? '#FFFFFF' : accent }}>{icon}</span>
        <p
          className="text-[11px] uppercase tracking-wider font-semibold"
          style={{ color: highlight ? 'rgba(255,255,255,0.8)' : accent }}
        >
          {label}
        </p>
      </div>
      <p
        className="text-3xl font-bold font-mono"
        style={{ color: highlight ? '#FFFFFF' : accent }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="text-xs"
          style={{ color: highlight ? 'rgba(255,255,255,0.7)' : '#B0A5B4' }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

function HotelColumn({
  hotel,
  stats,
  accentColor,
  borderColor,
}: {
  hotel: string
  stats: HotelStats
  accentColor: string
  borderColor: string
}) {
  const occPct = stats.avgOccupancy != null ? `${stats.avgOccupancy.toFixed(1)}%` : '—'
  const aboveTarget =
    stats.avgOccupancy != null && stats.avgOccupancy >= stats.target

  return (
    <div className="space-y-4">
      <div
        className="px-4 py-2.5 rounded-xl text-center font-bold text-white text-sm uppercase tracking-widest"
        style={{ background: borderColor }}
      >
        {hotel}
      </div>

      <KpiCard
        icon={<TrendingUp size={16} />}
        label="Occupation MTD"
        value={occPct}
        sub={`Objectif : ${stats.target}%${stats.daysWithData ? ` · ${stats.daysWithData} jour(s)` : ''}`}
        accent={aboveTarget ? '#16a34a' : '#d97706'}
        highlight={aboveTarget}
      />

      <KpiCard
        icon={<Star size={16} />}
        label="RPS — Satisfaction client"
        value={stats.avgRps != null ? stats.avgRps.toFixed(1) : '—'}
        sub="Moyenne du mois"
        accent={accentColor}
      />

      <KpiCard
        icon={<Users size={16} />}
        label="All Stars — Fidélité"
        value={stats.totalAllStars != null ? String(stats.totalAllStars) : '—'}
        sub="Cartes créées ce mois"
        accent="#0284c7"
      />
    </div>
  )
}

export function StatistiqueClient({ month, mercure, ibis, isManager, today, userId }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    mercure_rps: '', mercure_allstars: '',
    ibis_rps: '', ibis_allstars: '',
  })

  const handleSave = async () => {
    setSaving(true)
    const entries = [
      { hotel_id: 'mercure', rps: form.mercure_rps, allstars: form.mercure_allstars },
      { hotel_id: 'ibis',    rps: form.ibis_rps,    allstars: form.ibis_allstars },
    ]
    for (const e of entries) {
      const update: Record<string, number | null> = {}
      if (e.rps)     update.rps              = parseFloat(e.rps)
      if (e.allstars) update.all_stars_count = parseInt(e.allstars)
      if (Object.keys(update).length === 0) continue

      await supabase
        .from('daily_stats')
        .upsert({ hotel_id: e.hotel_id, stat_date: today, ...update }, { onConflict: 'hotel_id,stat_date' })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: '#C5C0B1' }}>
          Statistiques
        </p>
        <h2 className="text-2xl font-bold capitalize" style={{ color: '#602460' }}>{month}</h2>
      </div>

      {/* KPI grid — Mercure left, Ibis right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <HotelColumn hotel="Mercure" stats={mercure} accentColor="#602460" borderColor="#602460" />
        <HotelColumn hotel="Ibis"    stats={ibis}    accentColor="#e11d48" borderColor="#e11d48" />
      </div>

      {/* Manager data entry */}
      {isManager && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Target size={15} style={{ color: '#602460' }} />
              <p className="text-sm font-semibold" style={{ color: '#3D1640' }}>
                Saisir les données du jour ({today})
              </p>
            </div>
            {saved && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                Données enregistrées.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#602460' }}>Mercure</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">RPS (ex: 8.5)</Label>
                    <Input
                      type="number" step="0.1" min="0" max="10"
                      value={form.mercure_rps}
                      onChange={e => setForm(f => ({ ...f, mercure_rps: e.target.value }))}
                      placeholder="—"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">All Stars créés</Label>
                    <Input
                      type="number" min="0"
                      value={form.mercure_allstars}
                      onChange={e => setForm(f => ({ ...f, mercure_allstars: e.target.value }))}
                      placeholder="—"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#e11d48' }}>Ibis</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">RPS (ex: 8.5)</Label>
                    <Input
                      type="number" step="0.1" min="0" max="10"
                      value={form.ibis_rps}
                      onChange={e => setForm(f => ({ ...f, ibis_rps: e.target.value }))}
                      placeholder="—"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">All Stars créés</Label>
                    <Input
                      type="number" min="0"
                      value={form.ibis_allstars}
                      onChange={e => setForm(f => ({ ...f, ibis_allstars: e.target.value }))}
                      placeholder="—"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
