'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Upload, CheckCircle, X, EyeOff } from 'lucide-react'
import { isoDate } from '@/lib/utils'

interface MenuItem { id: number; name: string; outlet: string; recipe_id: number | null }
interface BeverageProduct { id: number; name: string; unit: string; sub_products: { id: number; name: string; decrement_factor: number }[] }
interface AiMapping { id: number; raw_name: string; product_id: number; confirmed: boolean }

interface ParsedLine {
  raw_name: string
  qty: number
  unit_price: number
  total_revenue: number
}

interface MappedLine extends ParsedLine {
  mapped_to: string
  ai_matched: boolean
}

interface Props {
  defaultDate: string
  menuItems: MenuItem[]
  beverages: BeverageProduct[]
  confirmedMappings: AiMapping[]
}

type Step = 1 | 2 | 3 | 4

function getSkipForever(): string[] {
  try { return JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('fb_skip_forever') || '[]' : '[]') }
  catch { return [] }
}

function saveSkipForever(list: string[]) {
  try { localStorage.setItem('fb_skip_forever', JSON.stringify(list)) } catch { /* noop */ }
}

export function UploadFbClient({ defaultDate, menuItems, beverages, confirmedMappings }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [date, setDate] = useState(defaultDate)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lines, setLines] = useState<MappedLine[]>([])
  const supabase = createClient()

  const allOptions = [
    ...menuItems.map(m => ({ value: `menu_item:${m.id}`, label: `[Menu] ${m.name} — ${m.outlet}` })),
    ...beverages.map(b => ({ value: `beverage:${b.id}`, label: `[Boisson] ${b.name}` })),
    ...beverages.flatMap(b => b.sub_products.map(sp => ({
      value: `sub_product:${sp.id}`,
      label: `[Boisson] ${b.name} — ${sp.name}`,
    }))),
  ]

  const preFillMapping = (rawName: string): { value: string; aiMatched: boolean } => {
    const mapping = confirmedMappings.find(m => m.raw_name.toLowerCase() === rawName.toLowerCase())
    if (mapping) {
      const menuItem = menuItems.find(mi => mi.id === mapping.product_id)
      if (menuItem) return { value: `menu_item:${menuItem.id}`, aiMatched: true }
      const bev = beverages.find(b => b.id === mapping.product_id)
      if (bev) return { value: `beverage:${bev.id}`, aiMatched: true }
    }
    const lower = rawName.toLowerCase()
    const menuMatch = menuItems.find(m => m.name.toLowerCase().includes(lower) || lower.includes(m.name.toLowerCase()))
    if (menuMatch) return { value: `menu_item:${menuMatch.id}`, aiMatched: true }
    return { value: '', aiMatched: false }
  }

  const handleParse = async () => {
    if (!file || !date) return
    setParsing(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('date', date)

      const res = await fetch('/api/upload-fb/parse', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const parsed: ParsedLine[] = await res.json()

      const skipForever = getSkipForever()
      const mapped: MappedLine[] = parsed
        .filter(line => !skipForever.includes(line.raw_name))
        .map(line => {
          const { value, aiMatched } = preFillMapping(line.raw_name)
          return { ...line, mapped_to: value, ai_matched: aiMatched }
        })
      setLines(mapped)
      setStep(3)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  const updateMapping = (i: number, value: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, mapped_to: value } : l))

  const handleSkip = (i: number) =>
    setLines(prev => prev.filter((_, idx) => idx !== i))

  const handleSkipForever = (rawName: string) => {
    const current = getSkipForever()
    const updated = [...new Set([...current, rawName])]
    saveSkipForever(updated)
    setLines(prev => prev.filter(l => l.raw_name !== rawName))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const { data: fbImport } = await supabase
        .from('fb_imports')
        .insert({ import_date: date, status: 'validated' })
        .select()
        .single()

      const fbImportId = fbImport?.id

      for (const line of lines) {
        if (!line.mapped_to) continue

        const [mapType, mapId] = line.mapped_to.split(':')

        if (mapType === 'menu_item') {
          await supabase.from('menu_item_sales').insert({
            sale_date: date,
            menu_item_id: parseInt(mapId),
            quantity: line.qty,
            fb_import_id: fbImportId,
          })
        }

        const productId = parseInt(mapId)
        if (productId) {
          await supabase.from('product_ai_mappings').upsert(
            { raw_name: line.raw_name, product_id: productId, confirmed: true },
            { onConflict: 'raw_name' }
          )
        }
      }

      setStep(4)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full max-w-5xl">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === s ? 'bg-[#602460] text-white' :
                step > s ? 'bg-green-500 text-white' :
                'bg-[#F4F2ED] text-[#B0A5B4] border border-[#E5E2D8]'
              }`}
            >
              {step > s ? '✓' : s}
            </div>
            {s < 4 && <div className={`h-0.5 w-8 ${step > s ? 'bg-green-500' : 'bg-[#E5E2D8]'}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-[#B0A5B4]">
          {step === 1 ? 'Sélectionner la date' : step === 2 ? 'Upload du fichier' : step === 3 ? 'Mapping & validation' : 'Confirmé'}
        </span>
      </div>

      {/* Step 1 & 2: Date + File */}
      {step <= 2 && (
        <Card>
          <CardHeader><CardTitle>Upload ventes F&B</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date de vente</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                max={isoDate(new Date())}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fichier Excel (.xlsx) ou PDF</Label>
              <div
                className="border-2 border-dashed border-[#E5E2D8] rounded-xl p-8 text-center cursor-pointer hover:border-[#602460] transition-colors"
                onClick={() => document.getElementById('fb-upload')?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f) { setFile(f); setStep(2) }
                }}
              >
                <Upload size={24} className="mx-auto mb-2 text-[#B0A5B4]" />
                {file ? (
                  <p className="text-sm font-medium text-[#602460]">{file.name}</p>
                ) : (
                  <p className="text-sm text-[#B0A5B4]">
                    Glisser-déposer ou cliquer pour sélectionner un fichier Excel ou PDF
                  </p>
                )}
                <input
                  id="fb-upload"
                  type="file"
                  accept=".pdf,.csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setStep(2) } }}
                />
              </div>
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
            <Button onClick={handleParse} disabled={!file || !date || parsing} className="w-full">
              {parsing ? 'Analyse en cours…' : 'Analyser le fichier →'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Mapping */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Mapping des ventes — {date}</CardTitle>
                <p className="text-xs text-[#B0A5B4] mt-1">
                  Extrait : Nom · Quantités vendues brutes · Ventes moins remises
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit (fichier)</TableHead>
                    <TableHead>Mapping produit</TableHead>
                    <TableHead>Qté brute</TableHead>
                    <TableHead>Ventes nettes (€)</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs max-w-[180px] truncate text-[#3D1640]">{line.raw_name}</TableCell>
                      <TableCell>
                        <select
                          value={line.mapped_to}
                          onChange={e => updateMapping(i, e.target.value)}
                          className="w-full h-8 rounded-md border border-[#E5E2D8] bg-white px-2 text-xs text-[#3D1640] focus:outline-none focus:ring-1 focus:ring-[#602460]/30"
                        >
                          <option value="">— Non mappé —</option>
                          {allOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </TableCell>
                      <TableCell className="font-mono text-[#3D1640]">{line.qty}</TableCell>
                      <TableCell className="font-mono text-[#602460] font-medium">{line.total_revenue?.toFixed(2)}</TableCell>
                      <TableCell>
                        {line.ai_matched
                          ? <Badge variant="validated">Auto-mappé</Badge>
                          : <Badge variant="pending">À mapper</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSkip(i)}
                            title="Ignorer pour cet import"
                            className="p-1 rounded text-[#B0A5B4] hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <X size={14} />
                          </button>
                          <button
                            onClick={() => handleSkipForever(line.raw_name)}
                            title="Ignorer toujours (ne plus afficher)"
                            className="p-1 rounded text-[#B0A5B4] hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <EyeOff size={14} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {lines.length === 0 && (
            <p className="text-sm text-center text-[#B0A5B4] py-4">Aucun produit à mapper.</p>
          )}
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>← Recommencer</Button>
            <Button onClick={handleSave} disabled={saving || lines.length === 0}>
              {saving ? 'Enregistrement…' : 'Valider les ventes →'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2 text-[#3D1640]">Ventes enregistrées !</h3>
            <p className="text-sm mb-6 text-[#B0A5B4]">
              Les ventes du {date} ont été importées et les mappings ont été sauvegardés.
            </p>
            <Button onClick={() => { setStep(1); setFile(null); setLines([]) }}>
              Nouveau upload
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
