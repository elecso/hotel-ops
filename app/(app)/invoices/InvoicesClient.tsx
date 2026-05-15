'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Upload, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDate, formatCurrency, currentMonth } from '@/lib/utils'
import { AddProductModal } from '@/components/inventory/AddProductModal'
import type { ProductCategory, RoomType, Supplier } from '@/lib/types'

interface Product { id: number; name: string; unit: string; type: string }
interface AiMapping { raw_name: string; product_id: number; confirmed: boolean }

interface ParsedLine {
  raw_description: string
  qty: number
  unit: string
  unit_price: number
  total: number
  ai_confidence?: number
  product_id: number | null
  ai_matched: boolean
}

interface Invoice {
  id: number
  upload_date: string
  status: string
  total_amount: number | null
  supplier: { name: string } | null
  lines: { id: number; raw_description: string; qty: number; unit_price: number; total: number; ai_confidence: number; product: { name: string } | null }[]
}

interface Props {
  invoices: Invoice[]
  suppliers: Supplier[]
  products: Product[]
  confirmedMappings: AiMapping[]
  userId: string
  isManager: boolean
}

const STATUS_VARIANT: Record<string, 'pending' | 'validated' | 'default'> = {
  pending: 'pending',
  ai_processed: 'default',
  validated: 'validated',
}

export function InvoicesClient({ invoices: initial, suppliers, products, confirmedMappings, userId, isManager }: Props) {
  const [invoices, setInvoices] = useState(initial)
  const [localProducts, setLocalProducts] = useState(products)
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [parsedLines, setParsedLines] = useState<ParsedLine[] | null>(null)
  const [pendingInvoiceId, setPendingInvoiceId] = useState<number | null>(null)
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null)
  const [createLineIdx, setCreateLineIdx] = useState<number | null>(null)
  const [createDefaultName, setCreateDefaultName] = useState('')
  const [allCategories, setAllCategories] = useState<ProductCategory[]>([])
  const [allRoomTypes, setAllRoomTypes] = useState<RoomType[]>([])
  const [metaLoaded, setMetaLoaded] = useState(false)
  const supabase = createClient()

  const handleOpenCreate = async (idx: number, rawDesc: string) => {
    setCreateLineIdx(idx)
    setCreateDefaultName(rawDesc)
    if (!metaLoaded) {
      const [{ data: cats }, { data: rts }] = await Promise.all([
        supabase.from('product_categories').select('*').order('name'),
        supabase.from('room_types').select('*').order('label'),
      ])
      setAllCategories(cats ?? [])
      setAllRoomTypes(rts ?? [])
      setMetaLoaded(true)
    }
  }

  const preFill = (rawDesc: string): { productId: number | null; aiMatched: boolean } => {
    const mapping = confirmedMappings.find(m => m.raw_name.toLowerCase() === rawDesc.toLowerCase())
    if (mapping) return { productId: mapping.product_id, aiMatched: true }
    const lower = rawDesc.toLowerCase()
    const match = products.find(p => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase()))
    if (match) return { productId: match.id, aiMatched: true }
    return { productId: null, aiMatched: false }
  }

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (supplierId) formData.append('supplier_id', supplierId)

      const res = await fetch('/api/invoices/parse', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const { invoiceId, lines } = await res.json()

      const mapped: ParsedLine[] = lines.map((l: ParsedLine) => {
        const { productId, aiMatched } = preFill(l.raw_description)
        return { ...l, product_id: productId, ai_matched: aiMatched }
      })

      setParsedLines(mapped)
      setPendingInvoiceId(invoiceId)
      if (file) setFileUrl(URL.createObjectURL(file))
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setParsing(false)
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
    if (!parsedLines || !pendingInvoiceId) return
    setSaving(true)
    const month = currentMonth()

    for (const line of parsedLines) {
      await supabase.from('invoice_lines').upsert({
        invoice_id: pendingInvoiceId,
        raw_description: line.raw_description,
        product_id: line.product_id,
        qty: line.qty,
        unit_price: line.unit_price,
        total: line.total,
        ai_confidence: line.ai_confidence ?? 0,
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
        const { data: sm } = await supabase
          .from('stock_months')
          .select('bought')
          .eq('product_id', line.product_id)
          .eq('month', month)
          .single()
        await supabase.from('stock_months')
          .update({ bought: (sm?.bought ?? 0) + line.qty })
          .eq('product_id', line.product_id)
          .eq('month', month)
      }
    }

    await supabase.from('invoices').update({ status: 'validated' }).eq('id', pendingInvoiceId)

    const { data: updated } = await supabase
      .from('invoices')
      .select('*, supplier:suppliers(name), lines:invoice_lines(*, product:products(name))')
      .order('upload_date', { ascending: false })
      .limit(30)

    setInvoices(updated ?? [])
    setParsedLines(null)
    setPendingInvoiceId(null)
    setFile(null)
    if (fileUrl) { URL.revokeObjectURL(fileUrl); setFileUrl(null) }
    setSaving(false)
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Upload section */}
      {!parsedLines && (
        <Card>
          <CardHeader><CardTitle>Importer une facture</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fournisseur</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div
              className="border-2 border-dashed border-[#C5C0B1] rounded-[10px] p-8 text-center cursor-pointer hover:border-[#602460] transition-colors"
              onClick={() => document.getElementById('inv-upload')?.click()}
            >
              <Upload size={24} className="mx-auto mb-2" style={{ color: '#C5C0B1' }} />
              {file ? (
                <p className="text-sm font-medium" style={{ color: '#602460' }}>{file.name}</p>
              ) : (
                <p className="text-sm" style={{ color: '#C5C0B1' }}>Glisser-déposer ou cliquer — PDF ou CSV</p>
              )}
              <input id="inv-upload" type="file" accept=".pdf,.csv,.xlsx,.xls" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
            <Button onClick={handleParse} disabled={!file || parsing}>
              {parsing ? 'Analyse Claude AI…' : 'Analyser la facture →'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Parsed lines mapping */}
      {parsedLines && (
        <div className="space-y-6">
          {/* Mapping table */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Mapping des lignes de facture</CardTitle>
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
                          <div className="flex items-center gap-1">
                            <select
                              value={line.product_id ?? ''}
                              onChange={e => updateLine(i, e.target.value ? parseInt(e.target.value) : null)}
                              className="flex-1 h-8 rounded border border-[#C5C0B1] bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#7E3A7E]"
                            >
                              <option value="">— Non mappé —</option>
                              {localProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button
                              onClick={() => handleOpenCreate(i, line.raw_description)}
                              className="h-8 w-8 flex items-center justify-center rounded border border-[#E5E2D8] bg-[#F4F2ED] text-[#602460] hover:bg-[#602460]/10 hover:border-[#602460]/40 transition-colors text-lg font-bold flex-shrink-0"
                              title="Créer un produit"
                            >+</button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            value={line.qty}
                            onChange={e => updateLineField(i, 'qty', e.target.value)}
                            className="w-16 h-7 rounded border border-[#E5E2D8] bg-white px-2 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#7E3A7E]"
                            min="0" step="0.001"
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            value={line.unit_price}
                            onChange={e => updateLineField(i, 'unit_price', e.target.value)}
                            className="w-20 h-7 rounded border border-[#E5E2D8] bg-white px-2 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#7E3A7E]"
                            min="0" step="0.01"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-sky-700 font-semibold">{line.total?.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => {
                setParsedLines(null)
                setPendingInvoiceId(null)
                if (fileUrl) { URL.revokeObjectURL(fileUrl); setFileUrl(null) }
              }}>← Annuler</Button>
              <Button onClick={handleValidate} disabled={saving}>
                {saving ? 'Validation…' : 'Valider la facture →'}
              </Button>
            </div>
          </div>

          {/* PDF preview below */}
          {fileUrl && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#C5C0B1' }}>
                Aperçu de la facture
              </p>
              <iframe
                src={fileUrl}
                title="Aperçu facture"
                className="w-full rounded-xl border border-[#E5E2D8]"
                style={{ height: '800px' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Invoice list */}
      <Card>
        <CardHeader><CardTitle>Factures importées</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8" style={{ color: '#C5C0B1' }}>
                    Aucune facture importée.
                  </TableCell>
                </TableRow>
              ) : invoices.map(inv => (
                <>
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer"
                    onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                  >
                    <TableCell>
                      {expandedInvoice === inv.id
                        ? <ChevronDown size={14} style={{ color: '#602460' }} />
                        : <ChevronRight size={14} style={{ color: '#602460' }} />}
                    </TableCell>
                    <TableCell>{formatDate(inv.upload_date)}</TableCell>
                    <TableCell>{inv.supplier?.name ?? '—'}</TableCell>
                    <TableCell className="font-mono">{inv.total_amount ? formatCurrency(inv.total_amount) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status] ?? 'default'}>
                        {inv.status === 'pending' ? 'En attente' : inv.status === 'ai_processed' ? 'Traité AI' : 'Validée'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expandedInvoice === inv.id && inv.lines?.map(line => (
                    <TableRow key={`line-${line.id}`} style={{ background: '#F4F2ED' }}>
                      <TableCell />
                      <TableCell colSpan={2} className="text-xs font-mono">{line.raw_description}</TableCell>
                      <TableCell className="text-xs font-mono">{line.product?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{formatCurrency(line.total)}</TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {createLineIdx !== null && (
        <AddProductModal
          open
          onClose={() => setCreateLineIdx(null)}
          onSaved={(product) => {
            if (product) {
              setLocalProducts(prev => [...prev, { id: product.id, name: product.name, unit: '', type: '' }]
                .sort((a, b) => a.name.localeCompare(b.name, 'fr')))
              setParsedLines(prev => prev
                ? prev.map((l, i) => i === createLineIdx ? { ...l, product_id: product.id } : l)
                : prev)
            }
            setCreateLineIdx(null)
          }}
          defaultName={createDefaultName}
          suppliers={suppliers}
          categories={allCategories}
          roomTypes={allRoomTypes}
        />
      )}
    </div>
  )
}
