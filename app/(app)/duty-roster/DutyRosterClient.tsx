'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Upload, ChevronDown, ChevronRight as ChRight } from 'lucide-react'
import { formatDate, isoDate, addDays, getWeekStart } from '@/lib/utils'
import type { Staff, DutyRoster } from '@/lib/types'

interface Props {
  weekStart: string
  weekDates: string[]
  staff: Staff[]
  roster: DutyRoster[]
  isManager: boolean
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const SHIFT_STYLES: Record<string, { bg: string; text: string; label?: string }> = {
  P:   { bg: '#dcfce7', text: '#166534' },
  TR:  { bg: '#dcfce7', text: '#166534' },
  RH:  { bg: '#fee2e2', text: '#991b1b' },
  CP:  { bg: '#ffedd5', text: '#9a3412' },
  CSS: { bg: '#ffedd5', text: '#9a3412' },
  AM:  { bg: '#fef9c3', text: '#854d0e' },
  AT:  { bg: '#fef9c3', text: '#854d0e' },
  MT:  { bg: '#fef9c3', text: '#854d0e' },
  F:   { bg: '#e0e7ff', text: '#3730a3' },
  FO:  { bg: '#e0e7ff', text: '#3730a3' },
  CJ:  { bg: '#f1f5f9', text: '#475569' },
}

const LEGEND = [
  { code: 'P',   label: 'Présent',         bg: '#dcfce7', text: '#166534' },
  { code: 'RH',  label: 'Repos hebdo',     bg: '#fee2e2', text: '#991b1b' },
  { code: 'CP',  label: 'Congé payé',      bg: '#ffedd5', text: '#9a3412' },
  { code: 'AM',  label: 'Arrêt maladie',   bg: '#fef9c3', text: '#854d0e' },
  { code: 'F',   label: 'Formation',       bg: '#e0e7ff', text: '#3730a3' },
  { code: '08:00', label: 'Horaire',       bg: '#ede9fe', text: '#602460' },
]

function cellStyle(value: string | undefined): React.CSSProperties {
  if (!value) return { background: 'transparent', color: '#C5C0B1' }
  const v = value.trim().toUpperCase()
  const preset = SHIFT_STYLES[v]
  if (preset) return { background: preset.bg, color: preset.text, fontWeight: 600, borderRadius: 6 }
  if (/^\d{2}:\d{2}/.test(value)) return { background: '#ede9fe', color: '#602460', fontWeight: 600, borderRadius: 6 }
  return { background: '#f4f2ed', color: '#3D1640', fontWeight: 500, borderRadius: 6 }
}

const SERVICE_ACCENT: Record<string, string> = {
  'Réception': '#602460',
  'F&B': '#d97706',
  'Hébergement': '#0284c7',
  'Rooms': '#0284c7',
  'Technique': '#16a34a',
  'RH': '#7c3aed',
  'Restauration': '#d97706',
  'Cuisine': '#d97706',
}

function serviceAccent(service: string): string {
  return SERVICE_ACCENT[service] ?? '#7B6B80'
}

export function DutyRosterClient({ weekStart, weekDates, staff: initialStaff, roster: initialRoster, isManager }: Props) {
  const router = useRouter()
  const [roster, setRoster] = useState<DutyRoster[]>(initialRoster)
  const [collapsedServices, setCollapsedServices] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const today = isoDate(new Date())
  const [filterService, setFilterService] = useState('')

  const getRosterValue = (staffId: number, date: string, shift: 'morning' | 'afternoon') =>
    roster.find(r => r.staff_id === staffId && r.day_date === date && r.shift === shift)?.value ?? ''

  const toggleService = (service: string) =>
    setCollapsedServices(prev =>
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    )

  const services = [...new Set(initialStaff.map(s => s.service))].filter(Boolean)
  const filteredServices = filterService ? services.filter(s => s === filterService) : services
  const staffByService = (service: string) => initialStaff.filter(s => s.service === service)

  const prevWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7)
    router.push(`/duty-roster?week=${isoDate(d)}`)
  }
  const nextWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7)
    router.push(`/duty-roster?week=${isoDate(d)}`)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const buffer = await file.arrayBuffer()
    let text: string
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
    catch { text = new TextDecoder('windows-1252').decode(buffer) }
    await parseAndImportCsv(text)
    setImporting(false)
  }

  const parseAndImportCsv = async (csv: string) => {
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return
    await supabase.from('duty_roster').delete()
      .eq('week_start', weekStart)
      .in('day_date', weekDates)
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';')
      const service = cols[0]?.trim()
      const matricule = cols[1]?.trim()
      const nameFull = cols[2]?.trim()
      const shiftCode = cols[3]?.trim()
      if (!matricule || !nameFull || !shiftCode) continue
      const shift: 'morning' | 'afternoon' = shiftCode === 'M' ? 'morning' : 'afternoon'
      const { data: staffRow } = await supabase
        .from('staff')
        .upsert({ matricule, full_name: nameFull, service, is_active: true }, { onConflict: 'matricule' })
        .select().single()
      if (!staffRow) continue
      for (let d = 0; d < 7; d++) {
        const value = cols[4 + d]?.trim()
        if (!value) continue
        const date = weekDates[d]
        if (date) {
          await supabase.from('duty_roster').upsert({
            staff_id: staffRow.id, week_start: weekStart, day_date: date, shift, value,
          }, { onConflict: 'staff_id,day_date,shift' })
        }
      }
    }
    const { data: newRoster } = await supabase.from('duty_roster').select('*')
      .eq('week_start', weekStart).in('day_date', weekDates)
    setRoster(newRoster ?? [])
  }

  const weekLabel = `${formatDate(weekStart)} – ${formatDate(isoDate(addDays(new Date(weekStart), 6)))}`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: '#C5C0B1' }}>Planning</p>
        <h2 className="text-2xl font-bold" style={{ color: '#602460' }}>Tableau de service</h2>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E5E2D8] p-1">
            <button
              onClick={prevWeek}
              className="p-1.5 rounded hover:bg-[#F4F2ED] transition-colors text-[#7B6B80]"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold px-3 text-[#3D1640] whitespace-nowrap">{weekLabel}</span>
            <button
              onClick={nextWeek}
              className="p-1.5 rounded hover:bg-[#F4F2ED] transition-colors text-[#7B6B80]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/duty-roster?week=${isoDate(getWeekStart())}`)}>
            Semaine actuelle
          </Button>
          {services.length > 1 && (
            <select
              value={filterService}
              onChange={e => setFilterService(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E2D8] bg-white px-3 text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#602460]/30"
            >
              <option value="">Tous les départements</option>
              {services.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <input type="file" ref={fileRef} accept=".csv,.txt" onChange={handleImport} className="hidden" />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload size={14} /> {importing ? 'Import…' : 'Importer CSV'}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#E5E2D8] bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th
                className="text-left px-4 py-3 font-semibold sticky left-0 z-10 min-w-[180px] rounded-tl-xl"
                style={{ background: '#3D1640', color: '#fff' }}
              >
                Agent
              </th>
              <th className="px-3 py-3 font-semibold w-24" style={{ background: '#3D1640', color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: 11 }}>
                Shift
              </th>
              {weekDates.map((date, i) => {
                const isToday = date === today
                const isWeekend = i >= 5
                return (
                  <th
                    key={date}
                    className="text-center px-2 py-3 font-semibold min-w-[80px]"
                    style={{
                      background: isToday ? '#602460' : isWeekend ? '#4a2048' : '#3D1640',
                      color: isToday ? '#fff' : isWeekend ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.9)',
                    }}
                  >
                    <span className="text-[13px]">{DAY_LABELS[i]}</span>
                    <br />
                    <span className="text-[11px] font-normal opacity-80">{new Date(date + 'T12:00:00').getDate()}</span>
                    {isToday && <div className="w-1.5 h-1.5 rounded-full bg-white mx-auto mt-0.5" />}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filteredServices.map(service => {
              const serviceStaff = staffByService(service)
              const isCollapsed = collapsedServices.includes(service)
              const accent = serviceAccent(service)
              return (
                <>
                  <tr key={`svc-${service}`}>
                    <td
                      colSpan={9}
                      className="px-4 py-2 cursor-pointer"
                      style={{ background: '#F4F2ED', borderLeft: `3px solid ${accent}` }}
                      onClick={() => toggleService(service)}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChRight size={13} style={{ color: accent }} />
                          : <ChevronDown size={13} style={{ color: accent }} />}
                        <span className="font-bold text-xs uppercase tracking-widest" style={{ color: accent }}>
                          {service}
                        </span>
                        <span className="text-[11px] text-[#B0A5B4]">· {serviceStaff.length} agent{serviceStaff.length > 1 ? 's' : ''}</span>
                      </div>
                    </td>
                  </tr>

                  {!isCollapsed && serviceStaff.map((agent, agentIdx) => (
                    <>
                      <tr
                        key={`${agent.id}-M`}
                        style={{ borderLeft: `3px solid ${accent}` }}
                        className="group"
                      >
                        <td
                          className="px-4 py-2 font-semibold sticky left-0 z-10 text-[#3D1640] bg-white"
                          rowSpan={2}
                          style={{
                            borderBottom: `2px solid #E5E2D8`,
                            borderLeft: `3px solid ${accent}`,
                          }}
                        >
                          <span className="text-[13px]">{agent.full_name}</span>
                        </td>
                        <td className="px-3 py-2 text-center" style={{ background: '#fafaf8' }}>
                          <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                            style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                            Mat.
                          </span>
                        </td>
                        {weekDates.map(date => {
                          const val = getRosterValue(agent.id, date, 'morning')
                          const s = cellStyle(val)
                          const isToday = date === today
                          return (
                            <td key={date} className="px-1.5 py-2 text-center"
                              style={{ background: isToday ? '#fdf4ff' : undefined }}>
                              <span className="inline-block px-2 py-1 text-xs font-mono min-w-[52px]" style={s}>
                                {val || <span style={{ color: '#D4D0C8' }}>—</span>}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                      <tr
                        key={`${agent.id}-PM`}
                        style={{
                          borderLeft: `3px solid ${accent}`,
                          borderBottom: agentIdx < serviceStaff.length - 1 ? '2px solid #E5E2D8' : '1px solid #F4F2ED',
                        }}
                      >
                        <td className="px-3 py-2 text-center" style={{ background: '#fafaf8' }}>
                          <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                            style={{ background: '#e3f2fd', color: '#1565c0' }}>
                            A-M
                          </span>
                        </td>
                        {weekDates.map(date => {
                          const val = getRosterValue(agent.id, date, 'afternoon')
                          const s = cellStyle(val)
                          const isToday = date === today
                          return (
                            <td key={date} className="px-1.5 py-2 text-center"
                              style={{ background: isToday ? '#fdf4ff' : undefined }}>
                              <span className="inline-block px-2 py-1 text-xs font-mono min-w-[52px]" style={s}>
                                {val || <span style={{ color: '#D4D0C8' }}>—</span>}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    </>
                  ))}
                </>
              )
            })}

            {filteredServices.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#C5C0B1' }}>
                  Aucun planning pour cette semaine. Importez un fichier CSV.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-[#B0A5B4] font-medium uppercase tracking-wide mr-1">Légende :</span>
        {LEGEND.map(l => (
          <span
            key={l.code}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
            style={{ background: l.bg, color: l.text }}
          >
            <span className="font-mono">{l.code}</span>
            <span className="font-normal opacity-80">— {l.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
