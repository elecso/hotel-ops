'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { LogbookNews, MorningMeeting, ToiletCheck } from '@/lib/types'
import { ChevronDown, ChevronUp, CalendarDays, CheckCircle } from 'lucide-react'
import { formatDate, isoDate } from '@/lib/utils'

const CHECKERS = ['Fadila', 'HK', 'other'] as const
const TOILETS = [1, 2, 3] as const

interface Props {
  selectedDate: string
  news: LogbookNews[]
  meetings: MorningMeeting[]
  toiletChecks: ToiletCheck[]
  isAdmin: boolean
}

export function LogbookClient({ selectedDate, news, meetings, toiletChecks, isAdmin }: Props) {
  const router = useRouter()
  const [checks, setChecks] = useState<ToiletCheck[]>(toiletChecks)
  const [meetingOpen, setMeetingOpen] = useState(true)

  const today = isoDate(new Date())
  const supabase = createClient()
  const dateLabel = formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const getCheck = (toiletId: number, checkedBy: string) =>
    checks.find(c => c.toilet_id === toiletId && c.checked_by === checkedBy)

  const handleToggle = async (toiletId: 1 | 2 | 3, checkedBy: 'Fadila' | 'HK' | 'other') => {
    const existing = getCheck(toiletId, checkedBy)

    if (existing?.validated && !isAdmin) return // only admin can untick

    if (existing?.validated) {
      // Admin untick
      const { error } = await supabase
        .from('toilet_checks')
        .update({ validated: false })
        .eq('id', existing.id)
      if (!error) {
        setChecks(prev => prev.map(c => c.id === existing.id ? { ...c, validated: false } : c))
      }
    } else {
      // Tick
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('toilet_checks')
        .upsert({
          check_date: selectedDate,
          toilet_id: toiletId,
          checked_by: checkedBy,
          check_time: now,
          validated: true,
        }, { onConflict: 'check_date,toilet_id,checked_by' })
        .select()
        .single()
      if (!error && data) {
        setChecks(prev => {
          const idx = prev.findIndex(c => c.toilet_id === toiletId && c.checked_by === checkedBy)
          if (idx >= 0) return prev.map((c, i) => i === idx ? data : c)
          return [...prev, data]
        })
      }
    }
  }

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return null
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6 max-w-5xl">
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
            className="h-9 px-3 rounded-[6px] border border-[#C5C0B1] bg-white text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#7E3A7E]"
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
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[#DFDBCF] text-[#3D1640]">{a}</span>
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

      {/* Toilet checks — buttons instead of checkboxes */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#C5C0B1' }}>
          Contrôles sanitaires
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#DFDBCF' }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-[#3D1640]">Sanitaire</th>
                    {CHECKERS.map(c => (
                      <th key={c} className="text-center px-4 py-2.5 font-semibold text-[#3D1640]">
                        {c === 'other' ? 'Autre' : c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TOILETS.map(toiletId => (
                    <tr key={toiletId} className="border-t border-[#C5C0B1]">
                      <td className="px-4 py-3 font-medium text-[#602460]">Sanitaire {toiletId}</td>
                      {CHECKERS.map(checker => {
                        const check = getCheck(toiletId, checker)
                        const isChecked = check?.validated ?? false
                        return (
                          <td key={checker} className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => handleToggle(toiletId as 1|2|3, checker as 'Fadila'|'HK'|'other')}
                                disabled={isChecked && !isAdmin}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
                                  isChecked
                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                    : 'bg-white text-[#602460] border border-[#C5C0B1] hover:bg-[#602460] hover:text-white'
                                } ${isChecked && !isAdmin ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                {isChecked ? (
                                  <><CheckCircle size={13} /> Validé</>
                                ) : (
                                  'Valider'
                                )}
                              </button>
                              {check?.check_time && (
                                <span className="text-[10px]" style={{ color: '#C5C0B1' }}>
                                  {formatTime(check.check_time)}
                                </span>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
