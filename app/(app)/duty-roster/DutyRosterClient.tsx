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

function cellStyle(value: string | undefined): React.CSSProperties {
  if (!value) return { background: 'transparent', color: '#C5C0B1' }
  if (value === 'P') return { background: '#DFDBCF', color: '#3D1640' }
  if (value === 'RH') return { background: '#FDEAEF', color: '#E8003D', fontWeight: 600 }
  if (/^\d{2}:\d{2}/.test(value)) return { background: 'white', color: '#602460', fontWeight: 600 }
  return { background: 'white', color: '#3D1640' }
}

export function DutyRosterClient({ weekStart, weekDates, staff: initialStaff, roster: initialRoster, isManager }: Props) {
  const router = useRouter()
  const [roster, setRoster] = useState<DutyRoster[]>(initialRoster)
  const [collapsedServices, setCollapsedServices] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const today = isoDate(new Date())

  const getRosterValue = (staffId: number, date: string, shift: 'morning' | 'afternoon') =>
    roster.find(r => r.staff_id === staffId && r.day_date === date && r.shift === shift)?.value ?? ''

  const toggleService = (service: string) =>
    setCollapsedServices(prev =>
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    )

  const services = [...new Set(initialStaff.map(s => s.service))].filter(Boolean)
  const staffByService = (service: string) => initialStaff.filter(s => s.service === service)

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    router.push(`/duty-roster?week=${isoDate(d)}`)
  }
  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    router.push(`/duty-roster?week=${isoDate(d)}`)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const text = await file.text()
    await parseAndImportCsv(text)
    setImporting(false)
  }

  const parseAndImportCsv = async (csv: string) => {
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return

    // Day columns are at indices 4-10 (Lu through Di)
    const dayStartIdx = 4
    const numDays = 7

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';')
      const service = cols[0]?.trim()
      const matricule = cols[1]?.trim()
      const nameFull = cols[2]?.trim()
      const shiftCode = cols[3]?.trim()

      if (!matricule || !nameFull || !shiftCode) continue

      // Column 3: "M" = morning, "S" = afternoon/soir
      const shift: 'morning' | 'afternoon' = shiftCode === 'M' ? 'morning' : 'afternoon'

      // Upsert staff
      const { data: staffRow } = await supabase
        .from('staff')
        .upsert({ matricule, full_name: nameFull, service, is_active: true }, { onConflict: 'matricule' })
        .select()
        .single()

      if (!staffRow) continue

      for (let d = 0; d < numDays; d++) {
        const colIdx = dayStartIdx + d
        const value = cols[colIdx]?.trim()
        if (!value) continue
        const date = weekDates[d]
        if (date) {
          await supabase.from('duty_roster').upsert({
            staff_id: staffRow.id,
            week_start: weekStart,
            day_date: date,
            shift,
            value,
          }, { onConflict: 'staff_id,day_date,shift' })
        }
      }
    }

    // Reload
    const { data: newRoster } = await supabase
      .from('duty_roster')
      .select('*')
      .eq('week_start', weekStart)
      .in('day_date', weekDates)
    setRoster(newRoster ?? [])
  }

  const weekLabel = `${formatDate(weekStart)} – ${formatDate(isoDate(addDays(new Date(weekStart), 6)))}`

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft size={16} /></Button>
          <span className="text-sm font-medium px-2" style={{ color: '#3D1640' }}>{weekLabel}</span>
          <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight size={16} /></Button>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/duty-roster?week=${isoDate(getWeekStart())}`)}>
            Semaine actuelle
          </Button>
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <input type="file" ref={fileRef} accept=".csv,.txt" onChange={handleImport} className="hidden" />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload size={16} /> {importing ? 'Import…' : 'Importer CSV'}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[10px] border border-[#C5C0B1] overflow-x-auto">
        <table className="w-full text-sm border-collapse table-fixed" style={{ minWidth: '800px' }}>
          <thead>
            <tr style={{ background: '#DFDBCF' }}>
              <th className="text-left px-4 py-2.5 font-semibold text-[#3D1640] sticky left-0 bg-[#DFDBCF] z-10 min-w-[180px]">
                Agent
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-[#3D1640] w-20">Shift</th>
              {weekDates.map((date, i) => (
                <th
                  key={date}
                  className="text-center px-3 py-2.5 font-semibold min-w-[80px]"
                  style={{ color: date === today ? '#FFFFFF' : '#3D1640', background: date === today ? '#602460' : 'transparent' }}
                >
                  {DAY_LABELS[i]}<br />
                  <span className="font-normal text-[11px]">{new Date(date).getDate()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map(service => {
              const serviceStaff = staffByService(service)
              const isCollapsed = collapsedServices.includes(service)
              return (
                <>
                  {/* Service header */}
                  <tr key={`service-${service}`} style={{ background: '#DFDBCF' }}>
                    <td
                      colSpan={9}
                      className="px-4 py-2 cursor-pointer"
                      onClick={() => toggleService(service)}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChRight size={14} style={{ color: '#602460' }} /> : <ChevronDown size={14} style={{ color: '#602460' }} />}
                        <span className="font-semibold text-xs uppercase tracking-wide" style={{ color: '#3D1640' }}>
                          {service}
                        </span>
                        <span className="text-xs" style={{ color: '#C5C0B1' }}>({serviceStaff.length} agents)</span>
                      </div>
                    </td>
                  </tr>

                  {!isCollapsed && serviceStaff.map(agent => (
                    <>
                      {/* Morning row */}
                      <tr key={`${agent.id}-morning`} className="border-b border-[#F4F2ED]">
                        <td className="px-4 py-1.5 font-medium sticky left-0 bg-white z-10 text-[#3D1640]" rowSpan={2}>
                          {agent.full_name}
                        </td>
                        <td className="px-3 py-1.5 text-xs" style={{ color: '#C5C0B1' }}>Matin</td>
                        {weekDates.map(date => {
                          const val = getRosterValue(agent.id, date, 'morning')
                          const s = cellStyle(val)
                          return (
                            <td key={date} className="px-1 py-1.5 text-center">
                              <span
                                className="inline-block px-2 py-0.5 rounded text-xs font-mono min-w-[48px]"
                                style={s}
                              >
                                {val || '—'}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                      {/* Afternoon row */}
                      <tr key={`${agent.id}-afternoon`} className="border-b border-[#C5C0B1]">
                        <td className="px-3 py-1.5 text-xs" style={{ color: '#C5C0B1' }}>A-M</td>
                        {weekDates.map(date => {
                          const val = getRosterValue(agent.id, date, 'afternoon')
                          const s = cellStyle(val)
                          return (
                            <td key={date} className="px-1 py-1.5 text-center">
                              <span
                                className="inline-block px-2 py-0.5 rounded text-xs font-mono min-w-[48px]"
                                style={s}
                              >
                                {val || '—'}
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

            {services.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-10 text-sm" style={{ color: '#C5C0B1' }}>
                  Aucun planning pour cette semaine. Importez un fichier CSV.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
