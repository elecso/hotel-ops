'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { LogbookNews, MorningMeeting, ToiletCheck } from '@/lib/types'
import { ChevronDown, ChevronUp, CalendarDays, CheckCircle, Download } from 'lucide-react'
import { formatDate, isoDate } from '@/lib/utils'
import * as XLSX from 'xlsx'

const TOILETS = [1, 2, 3] as const
const TOILET_NAMES: Record<number, string> = {
  1: 'Toilette Restaurant',
  2: 'Toilette Ibis',
  3: 'Toilette Séminaire',
}

interface Props {
  selectedDate: string
  news: LogbookNews[]
  meetings: MorningMeeting[]
  toiletChecks: ToiletCheck[]
  isAdmin: boolean
  staffNames: string[]
}

export function LogbookClient({ selectedDate, news, meetings, toiletChecks, staffNames }: Props) {
  const router = useRouter()
  const [checks, setChecks] = useState<ToiletCheck[]>(toiletChecks)
  const [meetingOpen, setMeetingOpen] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [validatingToilet, setValidatingToilet] = useState<number | null>(null)
  const [checkerName, setCheckerName] = useState('')

  const today = isoDate(new Date())
  const supabase = createClient()
  const dateLabel = formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const yearStart = selectedDate.substring(0, 4) + '-01-01'
      const { data } = await supabase
        .from('toilet_checks')
        .select('*')
        .gte('check_date', yearStart)
        .lte('check_date', today)
        .order('check_date', { ascending: true })
        .order('toilet_id', { ascending: true })

      const rows = (data ?? []).map((c: ToiletCheck) => ({
        Date: c.check_date,
        Sanitaire: `Sanitaire ${c.toilet_id}`,
        'Contrôlé par': c.checked_by === 'other' ? 'Autre' : c.checked_by,
        Validé: c.validated ? 'Oui' : 'Non',
        Heure: c.check_time ? new Date(c.check_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Contrôles sanitaires')
      XLSX.writeFile(wb, `controles-sanitaires-${selectedDate.substring(0, 4)}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  const getToiletChecks = (toiletId: number) =>
    checks.filter(c => c.toilet_id === toiletId)

  const handleValidate = async (toiletId: number, name: string) => {
    if (!name.trim()) return
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('toilet_checks')
      .upsert({
        check_date: selectedDate,
        toilet_id: toiletId,
        checked_by: name.trim(),
        check_time: now,
        validated: true,
      }, { onConflict: 'check_date,toilet_id,checked_by' })
      .select()
      .single()
    if (!error) {
      const record = { ...(data ?? {}), check_date: selectedDate, toilet_id: toiletId, checked_by: name.trim(), check_time: now, validated: true }
      setChecks(prev => {
        const idx = prev.findIndex(c => c.toilet_id === toiletId && c.checked_by === name.trim())
        if (idx >= 0) return prev.map((c, i) => i === idx ? record : c)
        return [...prev, record as ToiletCheck]
      })
    }
    setValidatingToilet(null)
    setCheckerName('')
  }

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return null
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6 w-full">
      {/* Date header with navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: '#C5C0B1' }}>Journal du</p>
          <h2 className="text-2xl font-bold capitalize" style={{ color: '#602460' }}>
            {dateLabel}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => router.push(`/logbook?date=${e.target.value}`)}
            className="h-9 px-3 rounded-md border border-[#E5E2D8] bg-white text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#602460]/30"
          />
          {selectedDate !== today && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/logbook')}
              className="flex items-center gap-1.5"
            >
              <CalendarDays size={14} />
              Aujourd&apos;hui
            </Button>
          )}
        </div>
      </div>

      {/* News + Meeting side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* News */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#C5C0B1' }}>
            Actualités du jour
          </h2>
          {news.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm py-2" style={{ color: '#C5C0B1' }}>Aucune actualité pour ce jour.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {news.map(n => (
                <Card key={n.id} hotel="mercure">
                  <CardHeader>
                    <CardTitle className="text-base">{n.title}</CardTitle>
                    {n.source && <p className="text-xs mt-0.5" style={{ color: '#C5C0B1' }}>Source: {n.source}</p>}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#3D1640' }}>{n.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Morning meeting */}
        <div>
          <button
            onClick={() => setMeetingOpen(o => !o)}
            className="flex items-center gap-2 w-full text-left mb-3"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#C5C0B1' }}>
              Réunion du matin
            </h2>
            {meetingOpen ? <ChevronUp size={14} style={{ color: '#C5C0B1' }} /> : <ChevronDown size={14} style={{ color: '#C5C0B1' }} />}
          </button>
          {meetingOpen && (
            meetings.length === 0 ? (
              <Card>
                <CardContent>
                  <p className="text-sm py-2" style={{ color: '#C5C0B1' }}>Aucune note de réunion pour ce jour.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {meetings.map(m => (
                  <Card key={m.id}>
                    <CardContent>
                      {m.attendees && m.attendees.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {m.attendees.map((a, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[#F4F2ED] text-[#602460] border border-[#E5E2D8]">{a}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap" style={{ color: '#3D1640' }}>{m.notes}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Toilet checks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#C5C0B1' }}>
            Contrôles sanitaires
          </h2>
          <Button variant="secondary" size="sm" onClick={handleExportExcel} disabled={exporting}>
            <Download size={13} /> {exporting ? 'Export…' : `Export Excel ${selectedDate.substring(0, 4)}`}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TOILETS.map(toiletId => {
            const toiletChecksForId = getToiletChecks(toiletId)
            const isValidating = validatingToilet === toiletId
            return (
              <div
                key={toiletId}
                className="bg-white rounded-xl border border-[#E5E2D8] p-4 space-y-3"
              >
                <h3 className="font-semibold text-[#602460] text-sm">{TOILET_NAMES[toiletId]}</h3>

                {toiletChecksForId.length > 0 ? (
                  <div className="space-y-1.5">
                    {toiletChecksForId.map((check, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[#16a34a]">
                        <CheckCircle size={13} />
                        <span className="font-medium">{check.checked_by}</span>
                        {check.check_time && (
                          <span className="text-[#B0A5B4]">{formatTime(check.check_time)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#B0A5B4]">Non contrôlé</p>
                )}

                {isValidating ? (
                  <div className="space-y-2">
                    <select
                      value={checkerName}
                      onChange={e => setCheckerName(e.target.value)}
                      className="w-full h-8 rounded-md border border-[#E5E2D8] bg-white px-2 text-xs text-[#3D1640] focus:outline-none focus:ring-1 focus:ring-[#602460]/40"
                    >
                      <option value="">Sélectionner un nom…</option>
                      {staffNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleValidate(toiletId, checkerName)}
                        disabled={!checkerName}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[#602460] text-white hover:bg-[#4a1a4a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <CheckCircle size={12} /> Confirmer
                      </button>
                      <button
                        onClick={() => { setValidatingToilet(null); setCheckerName('') }}
                        className="px-3 py-1.5 rounded-md text-xs font-medium border border-[#E5E2D8] text-[#7B6B80] hover:bg-[#F4F2ED] transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setValidatingToilet(toiletId); setCheckerName('') }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#E5E2D8] text-[#602460] hover:bg-[#602460] hover:text-white hover:border-[#602460] transition-colors"
                  >
                    + Valider
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
