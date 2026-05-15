'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Upload, CheckCircle, X, EyeOff, Plus, Download } from 'lucide-react'
import { isoDate } from '@/lib/utils'

interface MenuItem { id: number; name: string; outlet: string; recipe_id: number | null }
interface BeverageProduct { id: number; name: string; unit: string; sub_products: { id: number; name: string; decrement_factor: number }[] }
interface AiMapping { id: number; raw_name: string; product_id: number; confirmed: boolean }

interface ParsedLine {
  raw_name: string
  qty: number
}

interface MappedLine extends ParsedLine {
  mapped_to: string
  ai_matched: boolean
}

interface N8nImport {
  id: number
  import_date: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw_json: any[]
}

interface Props {
  defaultDate: string
  menuItems: MenuItem[]
  beverages: BeverageProduct[]
  confirmedMappings: AiMapping[]
  pendingN8nImports: N8nImport[]
}

type Step = 1 | 2 | 3 | 4

function getSkipForever(): string[] {
  try { return JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('fb_skip_forever') || '[]' : '[]') }
  catch { return [] }
}

function saveSkipForever(list: string[]) {
  try { localStorage.setItem('fb_skip_forever', JSON.stringify(list)) } catch { /* noop */ }
}

interface CreateProductForm {
  lineIdx: number
  name: string
  type: 'food' | 'beverage'
  unit: string
}

export function UploadFbClient({ defaultDate, menuItems, beverages, confirmedMappings, pendingN8nImports }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [mode, setMode] = useState<'file' | 'json' | 'n8n'>('file')
  const [date, setDate] = useState(defaultDate)
  const [file, setFile] = useState<File | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lines, setLines] = useState<MappedLine[]>([])
  const [localMenuItems, setLocalMenuItems] = useState<MenuItem[]>(menuItems)
  const [localBeverages, setLocalBeverages] = useState<BeverageProduct[]>(beverages)
  const [createForm, setCreateForm] = useState<CreateProductForm | null>(null)
  const [creating, setCreating] = useState(false)
  const [loadedN8nId, setLoadedN8nId] = useState<number | null>(null)
  const supabase = createClient()

  const buildOptions = (items: MenuItem[], bevs: BeverageProduct[]) => [
    ...items.map(m => ({ value: `menu_item:${m.id}`, label: `[Menu] ${m.name} — ${m.outlet}` })),
    ...bevs.map(b => ({ value: `beverage:${b.id}`, label: `[Boisson] ${b.name}` })),
    ...bevs.flatMap(b => b.sub_products.map(sp => ({
      value: `sub_product:${sp.id}`,
      label: `[Boisson] ${b.name} — ${sp.name}`,
    }))),
  ]

  const preFillMapping = (rawName: string): { value: string; aiMatched: boolean } => {
    const mapping = confirmedMappings.find(m => m.raw_name.toLowerCase() === rawName.toLowerCase())
    if (mapping) {
      const menuItem = localMenuItems.find(mi => mi.id === mapping.product_id)
      if (menuItem) return { value: `menu_item:${menuItem.id}`, aiMatched: true }
      const bev = localBeverages.find(b => b.id === mapping.product_id)
      if (bev) return { value: `beverage:${bev.id}`, aiMatched: true }
    }
    const lower = rawName.toLowerCase()
    const menuMatch = localMenuItems.find(m => m.name.toLowerCase().includes(lower) || lower.includes(m.name.toLowerCase()))
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

  const handleParseJson = () => {
    setError('')
    if (!jsonText.trim()) { setError('Coller le JSON N8N dans le champ ci-dessus.'); return }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = JSON.parse(jsonText)
      if (!Array.isArray(raw)) throw new Error('Le JSON doit être un tableau [].')
      const skipForever = getSkipForever()
      const parsed: ParsedLine[] = raw.map(item => ({
        // Handle various key names: Produit / produit / product / name / Nom
        raw_name: String(item.Produit ?? item.produit ?? item.product ?? item.name ?? item.Nom ?? item.nom ?? '').trim(),
        qty: Number(item.quantity ?? item.qty ?? item.Quantite ?? item.quantite ?? item.Qte ?? 0),
      })).filter(l => l.raw_name && !skipForever.includes(l.raw_name))

      const mapped: MappedLine[] = parsed.map(line => {
        const { value, aiMatched } = preFillMapping(line.raw_name)
        return { ...line, mapped_to: value, ai_matched: aiMatched }
      })
      setLines(mapped)
      setStep(3)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  const handleLoadN8n = (imp: N8nImport) => {
    setError('')
    setDate(imp.import_date)
    setLoadedN8nId(imp.id)
    const skipForever = getSkipForever()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: ParsedLine[] = (imp.raw_json ?? []).map((item: any) => ({
      raw_name: String(item.Produit ?? item.produit ?? item.product ?? item.name ?? item.Nom ?? item.nom ?? '').trim(),
      qty: Number(item.quantity ?? item.qty ?? item.Quantite ?? item.quantite ?? item.Qte ?? 0),
    })).filter((l: ParsedLine) => l.raw_name && !skipForever.includes(l.raw_name))

    const mapped: MappedLine[] = parsed.map(line => {
      const { value, aiMatched } = preFillMapping(line.raw_name)
      return { ...line, mapped_to: value, ai_matched: aiMatched }
    })
    setLines(mapped)
    setStep(3)
  }

  const updateMapping = (i: number, value: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, mapped_to: value } : l))

  const handleSkip = (i: number) =>
    setLines(prev => prev.filter((_, idx) => idx !== i))

  const handleSkipForever = (rawName: string) => {
    const current = getSkipForever()
    saveSkipForever([...new Set([...current, rawName])])
    setLines(prev => prev.filter(l => l.raw_name !== rawName))
  }

  const handleCreateProduct = async () => {
    if (!createForm || !createForm.name.trim()) return
    setCreating(true)
    try {
      if (createForm.type === 'food') {
        const { data } = await supabase
          .from('menu_items')
          .insert({ name: createForm.name.trim(), outlet: 'lunch', is_active: true })
          .select('id, name, outlet, recipe_id')
          .single()
        if (data) {
          const newItem = data as MenuItem
          setLocalMenuItems(prev => [...prev, newItem])
          setLines(prev => prev.map((l, idx) =>
            idx === createForm.lineIdx ? { ...l, mapped_to: `menu_item:${newItem.id}` } : l
          ))
        }
      } else {
        const { data } = await supabase
          .from('products')
          .insert({ name: createForm.name.trim(), type: 'beverage', unit: createForm.unit || null, is_active: true })
          .select('id, name, unit')
          .single()
        if (data) {
          const newBev: BeverageProduct = { id: data.id, name: data.name, unit: data.unit ?? '', sub_products: [] }
          setLocalBeverages(prev => [...prev, newBev])
          setLines(prev => prev.map((l, idx) =>
            idx === createForm.lineIdx ? { ...l, mapped_to: `beverage:${newBev.id}` } : l
          ))
        }
      }
      setCreateForm(null)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
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

      // Mark the originating N8N import as validated so it no longer appears in the pending list
      if (loadedN8nId) {
        await supabase.from('fb_imports').update({ status: 'validated' }).eq('id', loadedN8nId)
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

      {/* Step 1 & 2: Date + Input */}
      {step <= 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upload ventes F&B</CardTitle>
              {/* Mode toggle */}
              <div className="flex rounded-lg border border-[#E5E2D8] overflow-hidden text-xs font-semibold">
                <button
                  onClick={() => { setMode('file'); setError('') }}
                  className="px-4 py-1.5 transition-colors"
                  style={{ background: mode === 'file' ? '#602460' : '#F4F2ED', color: mode === 'file' ? '#fff' : '#7B6B80' }}
                >
                  Fichier
                </button>
                <button
                  onClick={() => { setMode('json'); setError('') }}
                  className="px-4 py-1.5 transition-colors"
                  style={{ background: mode === 'json' ? '#602460' : '#F4F2ED', color: mode === 'json' ? '#fff' : '#7B6B80' }}
                >
                  JSON (N8N)
                </button>
                <button
                  onClick={() => { setMode('n8n'); setError('') }}
                  className="px-4 py-1.5 transition-colors flex items-center gap-1"
                  style={{ background: mode === 'n8n' ? '#602460' : '#F4F2ED', color: mode === 'n8n' ? '#fff' : '#7B6B80' }}
                >
                  <Download size={11} />
                  N8N ↓
                  {pendingN8nImports.length > 0 && (
                    <span className="ml-1 rounded-full px-1.5 py-0 text-[10px] font-bold" style={{ background: mode === 'n8n' ? 'rgba(255,255,255,0.3)' : '#602460', color: mode === 'n8n' ? '#fff' : '#fff' }}>
                      {pendingN8nImports.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </CardHeader>
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

            {mode === 'file' ? (
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
                    <p className="text-sm text-[#B0A5B4]">Glisser-déposer ou cliquer pour sélectionner</p>
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
            ) : (
              <div className="space-y-1.5">
                <Label>JSON N8N — coller le tableau ici</Label>
                <p className="text-xs text-[#B0A5B4]">
                  Format attendu : <code className="bg-[#F4F2ED] px-1 rounded">{`[{"Produit":"...", "quantity": 5}, ...]`}</code>
                </p>
                <textarea
                  value={jsonText}
                  onChange={e => setJsonText(e.target.value)}
                  rows={8}
                  placeholder={'[\n  {"Produit": "PLAT DU JOUR", "quantity": 12},\n  ...\n]'}
                  className="w-full rounded-md border border-[#E5E2D8] bg-white px-3 py-2 text-xs font-mono text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#602460]/30 resize-none"
                />
              </div>
            )}

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

            {mode === 'n8n' && (
              <div className="space-y-2">
                <p className="text-xs text-[#B0A5B4]">
                  Imports N8N en attente — cliquer sur une ligne pour charger et mapper les ventes.
                </p>
                {pendingN8nImports.length === 0 ? (
                  <p className="text-sm text-center text-[#B0A5B4] py-6 border border-dashed border-[#E5E2D8] rounded-lg">
                    Aucun import N8N en attente.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E5E2D8] border border-[#E5E2D8] rounded-lg overflow-hidden">
                    {pendingN8nImports.map(imp => (
                      <div key={imp.id} className="flex items-center justify-between px-4 py-3 hover:bg-[#F4F2ED] transition-colors">
                        <div>
                          <p className="text-sm font-medium text-[#3D1640]">{imp.import_date}</p>
                          <p className="text-xs text-[#B0A5B4]">{Array.isArray(imp.raw_json) ? imp.raw_json.length : 0} produits · import #{imp.id}</p>
                        </div>
                        <Button size="sm" onClick={() => handleLoadN8n(imp)}>
                          Charger →
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mode === 'file' ? (
              <Button onClick={handleParse} disabled={!file || !date || parsing} className="w-full">
                {parsing ? 'Analyse en cours…' : 'Analyser le fichier →'}
              </Button>
            ) : mode === 'json' ? (
              <Button onClick={handleParseJson} disabled={!jsonText.trim() || !date} className="w-full">
                Importer le JSON →
              </Button>
            ) : null}
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
                  Colonnes extraites : Nom · Quantité vendue
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit (fichier)</TableHead>
                    <TableHead>Mapping produit</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs max-w-[180px] truncate text-[#3D1640]">{line.raw_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={line.mapped_to}
                            onChange={e => updateMapping(i, e.target.value)}
                            className="flex-1 h-8 rounded-md border border-[#E5E2D8] bg-white px-2 text-xs text-[#3D1640] focus:outline-none focus:ring-1 focus:ring-[#602460]/30"
                          >
                            <option value="">— Non mappé —</option>
                            {buildOptions(localMenuItems, localBeverages).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <button
                            onClick={() => setCreateForm({ lineIdx: i, name: line.raw_name, type: 'food', unit: '' })}
                            title="Créer un nouveau produit"
                            className="p-1.5 rounded text-[#B0A5B4] hover:text-[#602460] hover:bg-[#602460]/10 transition-colors flex-shrink-0"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[#3D1640]">{line.qty}</TableCell>
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

          {/* Inline create product modal */}
          {createForm && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Créer un nouveau produit</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Nom du produit</Label>
                    <Input
                      value={createForm.name}
                      onChange={e => setCreateForm(f => f ? { ...f, name: e.target.value } : f)}
                      placeholder="Nom du produit"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <select
                      value={createForm.type}
                      onChange={e => setCreateForm(f => f ? { ...f, type: e.target.value as 'food' | 'beverage' } : f)}
                      className="h-9 rounded-md border border-[#E5E2D8] px-2 text-sm text-[#3D1640] focus:outline-none"
                    >
                      <option value="food">Alimentation (Menu)</option>
                      <option value="beverage">Boisson</option>
                    </select>
                  </div>
                  {createForm.type === 'beverage' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Unité</Label>
                      <Input
                        value={createForm.unit}
                        onChange={e => setCreateForm(f => f ? { ...f, unit: e.target.value } : f)}
                        placeholder="ex: bouteille"
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateProduct} disabled={creating || !createForm.name.trim()}>
                    {creating ? 'Création…' : 'Créer et mapper'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setCreateForm(null)}>Annuler</Button>
                </div>
              </CardContent>
            </Card>
          )}

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
            <Button onClick={() => { setStep(1); setFile(null); setLines([]); setLoadedN8nId(null) }}>
              Nouveau upload
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
