'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, Trash2, ClipboardCheck, ChevronDown, ChevronRight, Check, X } from 'lucide-react'
import { formatDate, formatCurrency, currentMonth } from '@/lib/utils'
import Link from 'next/link'

const TYPES = ['room', 'beverage', 'food', 'cleaning_fb', 'cleaning_general', 'meeting', 'laundry']
const TYPE_LABELS: Record<string, string> = {
  room: 'Chambre', beverage: 'Boisson', food: 'Alimentation',
  cleaning_fb: 'Nettoyage F&B', cleaning_general: 'Nettoyage général',
  meeting: 'Réunion', laundry: 'Blanchisserie',
}

interface Product {
  id: number
  name: string
  type: string
  unit: string
  price_excl_tax: number | null
  packaging_desc: string | null
  supplier?: { name: string } | null
}
interface ReqLine { product_id: string; qty: string }

interface RequisitionLine {
  id: number
  product: { name: string; unit: string } | null
  qty_requested: number
  qty_validated: number | null
  product_id?: number
}

interface Requisition {
  id: number
  request_date: string
  status: string
  type: string
  notes: string
  lines: RequisitionLine[]
}

interface Props {
  products: Product[]
  myRequisitions: Requisition[]
  userId: string
  role: string
}

const STATUS_VARIANT: Record<string, 'pending' | 'validated' | 'rejected'> = {
  pending: 'pending',
  validated: 'validated',
  rejected: 'rejected',
}

export function RequisitionsClient({ products, myRequisitions: initial, userId, role }: Props) {
  const [requisitions, setRequisitions] = useState(initial)
  const [type, setType] = useState('food')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<ReqLine[]>([{ product_id: '', qty: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [expanded, setExpanded] = useState<number[]>([])
  const [lineQty, setLineQty] = useState<Record<number, string>>({})
  const [processing, setProcessing] = useState<number | null>(null)

  const supabase = createClient()
  const filteredProducts = products.filter(p => !type || p.type === type)
  const canValidate = role === 'admin' || role === 'manager'

  const addLine = () => setLines(prev => [...prev, { product_id: '', qty: '' }])
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))
  const updateLine = (i: number, key: keyof ReqLine, val: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l))

  const getSelectedProduct = (productId: string) => products.find(p => String(p.id) === productId)

  const toggleExpand = (id: number) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const getValidatedQty = (line: RequisitionLine) =>
    lineQty[line.id] !== undefined ? lineQty[line.id] : String(line.qty_requested)

  const handleApprove = async (req: Requisition) => {
    setProcessing(req.id)
    const month = currentMonth()
    for (const line of req.lines) {
      const qtyVal = parseFloat(getValidatedQty(line))
      if (isNaN(qtyVal) || qtyVal <= 0) continue
      await supabase.from('requisition_lines').update({ qty_validated: qtyVal }).eq('id', line.id)
      if (line.product_id) {
        await supabase.from('stock_months').upsert(
          { product_id: line.product_id, month, bought: 0, opening_stock: 0, used: 0 },
          { onConflict: 'product_id,month', ignoreDuplicates: true }
        )
        const { data: sm } = await supabase
          .from('stock_months').select('bought')
          .eq('product_id', line.product_id).eq('month', month).single()
        await supabase.from('stock_months').update({ bought: (sm?.bought ?? 0) + qtyVal })
          .eq('product_id', line.product_id).eq('month', month)
      }
    }
    await supabase.from('requisitions').update({ status: 'validated' }).eq('id', req.id)
    setRequisitions(prev => prev.map(r => r.id === req.id ? { ...r, status: 'validated' } : r))
    setExpanded(prev => prev.filter(x => x !== req.id))
    setProcessing(null)
  }

  const handleReject = async (reqId: number) => {
    setProcessing(reqId)
    await supabase.from('requisitions').update({ status: 'rejected' }).eq('id', reqId)
    setRequisitions(prev => prev.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r))
    setExpanded(prev => prev.filter(x => x !== reqId))
    setProcessing(null)
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    const validLines = lines.filter(l => l.product_id && l.qty && parseFloat(l.qty) > 0)
    if (validLines.length === 0) { setError('Ajoutez au moins une ligne.'); setSaving(false); return }

    const { data: req, error: rErr } = await supabase
      .from('requisitions')
      .insert({ requested_by: userId, type, notes, status: 'pending' })
      .select().single()

    if (rErr || !req) { setError(rErr?.message ?? 'Erreur'); setSaving(false); return }

    await supabase.from('requisition_lines').insert(
      validLines.map(l => ({
        requisition_id: req.id,
        product_id: parseInt(l.product_id),
        qty_requested: parseFloat(l.qty),
      }))
    )

    const { data: updated } = await supabase
      .from('requisitions')
      .select('*, lines:requisition_lines(*, product:products(name, unit))')
      .eq('requested_by', userId)
      .order('request_date', { ascending: false })
      .limit(20)

    setRequisitions(updated ?? [])
    setLines([{ product_id: '', qty: '' }])
    setNotes('')
    setSuccess(true)
    setSaving(false)
    setTimeout(() => setSuccess(false), 4000)
  }

  return (
    <div className="max-w-4xl space-y-6">
      {canValidate && (
        <Link href="/requisitions/validate">
          <Button variant="secondary" className="flex items-center gap-2">
            <ClipboardCheck size={16} />
            Valider les réquisitions en attente
          </Button>
        </Link>
      )}

      <Card>
        <CardHeader><CardTitle>Nouvelle réquisition</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {success && (
            <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-md px-3 py-2">
              Réquisition soumise avec succès.
            </div>
          )}
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type de produit</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Produits</Label>
              <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                <Plus size={14} /> Ajouter
              </Button>
            </div>
            {lines.map((line, i) => {
              const selectedProduct = getSelectedProduct(line.product_id)
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <select
                      value={line.product_id}
                      onChange={e => updateLine(i, 'product_id', e.target.value)}
                      className="flex-1 h-9 rounded-md border border-[#2a2d38] bg-[#13151c] px-3 text-sm text-[#f0f1f5] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                    >
                      <option value="">Sélectionner un produit…</option>
                      {filteredProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      placeholder="Qté"
                      value={line.qty}
                      onChange={e => updateLine(i, 'qty', e.target.value)}
                      className="w-24"
                      min="0"
                      step="0.1"
                    />
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-300">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {selectedProduct && (
                    <div className="flex items-center gap-3 pl-1 text-[11px] text-[#55596a]">
                      {selectedProduct.price_excl_tax != null && (
                        <span>Prix: <span className="font-semibold text-sky-400">{formatCurrency(selectedProduct.price_excl_tax)}</span></span>
                      )}
                      {selectedProduct.packaging_desc && (
                        <span>Cond.: <span className="font-semibold text-[#f0f1f5]">{selectedProduct.packaging_desc}</span></span>
                      )}
                      <span>Unité: <span className="font-semibold text-[#f0f1f5]">{selectedProduct.unit}</span></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optionnel)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Informations complémentaires…"
              rows={2}
            />
          </div>

          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Soumission…' : 'Soumettre la réquisition'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mes réquisitions récentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          {requisitions.length === 0 ? (
            <p className="px-5 py-4 text-sm text-[#55596a]">Aucune réquisition.</p>
          ) : (
            <div className="divide-y divide-[#2a2d38]">
              {requisitions.map(r => {
                const isPending = r.status === 'pending'
                const isOpen = expanded.includes(r.id)
                const canExpand = canValidate && isPending

                return (
                  <div key={r.id}>
                    <div
                      className={`flex items-center justify-between px-5 py-3 ${canExpand ? 'cursor-pointer hover:bg-[#22252f] transition-colors' : ''}`}
                      onClick={() => canExpand && toggleExpand(r.id)}
                    >
                      <div className="flex items-center gap-3">
                        {canExpand && (
                          isOpen
                            ? <ChevronDown size={14} className="text-indigo-400" />
                            : <ChevronRight size={14} className="text-[#55596a]" />
                        )}
                        <div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-[#f0f1f5] font-medium">{formatDate(r.request_date)}</span>
                            <span className="text-[#55596a]">·</span>
                            <span className="text-[#9095a8]">{TYPE_LABELS[r.type] ?? r.type}</span>
                            <span className="text-[#55596a]">·</span>
                            <span className="font-mono text-[#55596a] text-xs">{r.lines?.length ?? 0} ligne(s)</span>
                          </div>
                          {r.notes && <p className="text-[11px] text-[#55596a] mt-0.5 italic">{r.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>
                          {r.status === 'pending' ? 'En attente' : r.status === 'validated' ? 'Validée' : 'Rejetée'}
                        </Badge>
                        {canExpand && isPending && (
                          <span className="text-[11px] text-[#55596a]">cliquez pour valider</span>
                        )}
                      </div>
                    </div>

                    {isOpen && isPending && (
                      <div className="border-t border-[#2a2d38] bg-[#161920]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produit</TableHead>
                              <TableHead>Demandé</TableHead>
                              <TableHead>Qté validée</TableHead>
                              <TableHead>Unité</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {r.lines.map(line => (
                              <TableRow key={line.id}>
                                <TableCell>{line.product?.name ?? '—'}</TableCell>
                                <TableCell className="font-mono text-[#9095a8]">{line.qty_requested}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={getValidatedQty(line)}
                                    onChange={e => setLineQty(prev => ({ ...prev, [line.id]: e.target.value }))}
                                    className="h-7 w-20 text-xs"
                                    min="0"
                                    step="0.1"
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-xs text-[#55596a]">
                                  {line.product?.unit ?? ''}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="flex items-center gap-2 px-4 py-3">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={e => { e.stopPropagation(); handleReject(r.id) }}
                            disabled={processing === r.id}
                          >
                            <X size={14} /> Rejeter
                          </Button>
                          <Button
                            size="sm"
                            onClick={e => { e.stopPropagation(); handleApprove(r) }}
                            disabled={processing === r.id}
                          >
                            <Check size={14} /> Approuver
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
