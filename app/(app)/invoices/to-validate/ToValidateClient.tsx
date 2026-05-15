'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { FileText, Loader2, Check, Trash2 } from 'lucide-react'
import { currentMonth } from '@/lib/utils'

interface BucketFile { name: string; path: string; size: number; createdAt: string }
interface Supplier { id: number; name: string }
interface Product { id: number; name: string; unit: string; type: string }
interface AiMapping { raw_name: string; product_id: number }

interface ParsedLine {
  raw_description: string
  qty: number
  unit: string
  unit_price: number
  total: number
  product_id: number | null
  ai_matched: boolean
}

interface Props {
  files: BucketFile[]
  suppliers: Supplier[]
  products: Product[]
  confirmedMappings: AiMapping[]
  userId: string
}

export function ToValidateClient({ files: initialFiles, suppliers, products, confirmedMappings, userId }: Props) {
  const [files, setFiles] = useState(initialFiles)
  const [selectedFile, setSelectedFile] = useState<BucketFile | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [analysing, setAnalysing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [parsedLines, setParsedLines] = useState<ParsedLine[] | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const supabase = createClient()

  const preFill = (rawDesc: string): { productId: number | null; aiMatched: boolean } => {
    const mapping = confirmedMappings.find(m => m.raw_name.toLowerCase() === rawDesc.toLowerCase())
    if (mapping) return { productId: mapping.product_id, aiMatched: true }
    const lower = rawDesc.toLowerCase()
    const match = products.find(p => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase()))
    if (match) return { productId: match.id, aiMatched: true }
    return { productId: null, aiMatched: false }
  }

  const handleAnalyse = async (file: BucketFile) => {
    setSelectedFile(file)
    setAnalysing(true)
    setError('')
    setParsedLines(null)
    setSignedUrl(null)

    try {
      const res = await fetch('/api/invoices/parse-bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur analyse')

      const mapped: ParsedLine[] = (json.lines ?? []).map((l: ParsedLine) => {
        const { productId, aiMatched } = preFill(l.raw_description)
        return { ...l, product_id: productId, ai_matched: aiMatched }
      })
      setParsedLines(mapped)
      setSignedUrl(json.signedUrl ?? null)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setAnalysing(false)
    }
  }

  const updateLine = (i: number, productId: number | null) =>
    setParsedLines(prev => prev ? prev.map((l, idx) => idx === i ? { ...l, product_id: productId } : l) : prev)

  const updateLineField = (i: number, field: 'qty' | 'unit_price', value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return
    setParsedLines(prev => prev ? prev.map((l, idx) => {
      if (idx !== i) return l
      const updated = { ...l, [field]: num }
      updated.total = Math.round(updated.qty * updated.unit_price * 100) / 100
      return updated
    }) : prev)
  }

  const handleValidate = async () => {
    if (!parsedLines || !selectedFile) return
    setSaving(true)
    setError('')
    const month = currentMonth()

    try {
      // Create invoice record
      const total = parsedLines.reduce((sum, l) => sum + (l.total ?? 0), 0)
      const { data: invoice } = await supabase.from('invoices').insert({
        uploaded_by: userId,
        supplier_id: supplierId ? parseInt(supplierId) : null,
        status: 'validated',
        total_amount: total,
        file_url: selectedFile.path,
      }).select().single()

      if (invoice) {
        for (const line of parsedLines) {
          await supabase.from('invoice_lines').insert({
            invoice_id: invoice.id,
            raw_description: line.raw_description,
            product_id: line.product_id,
            qty: line.qty,
            unit_price: line.unit_price,
            total: line.total,
            ai_confidence: 0,
          })

          if (line.product_id && line.qty > 0) {
            await supabase.from('product_ai_mappings').upsert(
              { raw_name: line.raw_description, product_id: line.product_id, confirmed: true },
              { onConflict: 'raw_name' }
            )
            await supabase.from('stock_months').upsert(
              { product_id: line.product_id, month, bought: 0, opening_stock: 0, used: 0 },
              { onConflict: 'product_id,month', ignoreDuplicates: true }
            )
            const { data: sm } = await supabase.from('stock_months')
              .select('bought').eq('product_id', line.product_id).eq('month', month).single()
            await supabase.from('stock_months')
              .update({ bought: (sm?.bought ?? 0) + line.qty })
              .eq('product_id', line.product_id).eq('month', month)
          }
        }
      }

      // Delete file from bucket
      await fetch('/api/invoices/delete-file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile.path }),
      })

      setFiles(prev => prev.filter(f => f.path !== selectedFile.path))
      setParsedLines(null)
      setSelectedFile(null)
      setSignedUrl(null)
      setSupplierId('')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (parsedLines && selectedFile) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { setParsedLines(null); setSelectedFile(null); setSignedUrl(null) }}
            className="text-sm text-[#7B6B80] hover:text-[#602460]">← Retour</button>
          <span className="text-sm font-medium text-[#3D1640]">{selectedFile.name}</span>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Mapping des lignes — {selectedFile.name}</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#B0A5B4]">Fournisseur :</span>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Qté</TableHead>
                  <TableHead>PU €</TableHead>
                  <TableHead>Total €</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedLines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs min-w-[200px] break-words">{line.raw_description}</TableCell>
                    <TableCell>
                      <select
                        value={line.product_id ?? ''}
                        onChange={e => updateLine(i, e.target.value ? parseInt(e.target.value) : null)}
                        className="flex-1 h-8 rounded border border-[#C5C0B1] bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#7E3A7E] w-full"
                      >
                        <option value="">— Non mappé —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell>
                      <input type="number" value={line.qty}
                        onChange={e => updateLineField(i, 'qty', e.target.value)}
                        className="w-16 h-7 rounded border border-[#E5E2D8] bg-white px-2 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#7E3A7E]"
                        min="0" step="0.001" />
                    </TableCell>
                    <TableCell>
                      <input type="number" value={line.unit_price}
                        onChange={e => updateLineField(i, 'unit_price', e.target.value)}
                        className="w-20 h-7 rounded border border-[#E5E2D8] bg-white px-2 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#7E3A7E]"
                        min="0" step="0.01" />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-sky-700 font-semibold">{line.total?.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => { setParsedLines(null); setSelectedFile(null); setSignedUrl(null) }}>
            ← Annuler
          </Button>
          <Button onClick={handleValidate} disabled={saving}>
            {saving ? 'Validation…' : <><Check size={14} /> Valider & incrémenter stock</>}
          </Button>
        </div>

        {signedUrl && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-[#C5C0B1]">Aperçu de la facture</p>
            <iframe src={signedUrl} title="Aperçu facture" className="w-full rounded-xl border border-[#E5E2D8]" style={{ height: '800px' }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-4">
      <Card>
        <CardHeader><CardTitle>Factures à valider</CardTitle></CardHeader>
        <CardContent className="p-0">
          {files.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-[#B0A5B4]">
              Aucune facture en attente dans le bucket.
            </p>
          ) : (
            <div className="divide-y divide-[#E5E2D8]">
              {files.map(file => (
                <div key={file.path} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-[#B0A5B4] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#3D1640]">{file.name}</p>
                      {file.size > 0 && (
                        <p className="text-xs text-[#B0A5B4]">{(file.size / 1024).toFixed(0)} Ko</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="pending">En attente</Badge>
                    <Button size="sm" onClick={() => handleAnalyse(file)} disabled={analysing}>
                      {analysing && selectedFile?.path === file.path
                        ? <><Loader2 size={13} className="animate-spin" /> Analyse…</>
                        : 'Analyser →'}
                    </Button>
                    <button
                      onClick={async () => {
                        if (!confirm('Supprimer cette facture du bucket ?')) return
                        await fetch('/api/invoices/delete-file', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ path: file.path }),
                        })
                        setFiles(prev => prev.filter(f => f.path !== file.path))
                      }}
                      className="p-1.5 rounded text-[#B0A5B4] hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
    </div>
  )
}
