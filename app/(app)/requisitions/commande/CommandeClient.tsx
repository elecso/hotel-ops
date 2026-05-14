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
import { Plus, Trash2, ChevronDown, ChevronRight, Check, X } from 'lucide-react'
import { formatDate, formatCurrency, currentMonth } from '@/lib/utils'

const TYPES = ['room', 'beverage', 'food', 'cleaning_fb', 'cleaning_general', 'meeting', 'laundry']
const TYPE_LABELS: Record<string, string> = {
  room: 'Chambre', beverage: 'Boisson', food: 'Alimentation',
  cleaning_fb: 'Nettoyage F&B', cleaning_general: 'Nettoyage général',
  meeting: 'Réunion', laundry: 'Blanchisserie',
}

interface Product {
  id: number; name: string; type: string; unit: string
  price_excl_tax: number | null; packaging_desc: string | null
}
interface OrderLine { product_id: string; qty: string }
interface OrderRecord {
  id: number; order_date: string; status: string; type: string; notes: string
  lines: { id: number; product: { name: string; unit: string } | null; qty_ordered: number; qty_received: number | null }[]
}

interface Props {
  products: Product[]
  orders: OrderRecord[]
  userId: string
}

const STATUS_VARIANT: Record<string, 'pending' | 'validated' | 'rejected'> = {
  pending: 'pending', received: 'validated', cancelled: 'rejected',
}

export function CommandeClient({ products, orders: initial, userId }: Props) {
  const [orders, setOrders] = useState(initial)
  const [type, setType] = useState('food')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<OrderLine[]>([{ product_id: '', qty: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [expanded, setExpanded] = useState<number[]>([])
  const [processing, setProcessing] = useState<number | null>(null)
  const supabase = createClient()

  const filteredProducts = products.filter(p => !type || p.type === type)
  const getSelectedProduct = (productId: string) => products.find(p => String(p.id) === productId)
  const toggleExpand = (id: number) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const addLine = () => setLines(prev => [...prev, { product_id: '', qty: '' }])
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))
  const updateLine = (i: number, key: keyof OrderLine, val: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l))

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    const validLines = lines.filter(l => l.product_id && l.qty && parseFloat(l.qty) > 0)
    if (validLines.length === 0) { setError('Ajoutez au moins une ligne.'); setSaving(false); return }

    const { data: order, error: oErr } = await supabase.from('purchase_orders')
      .insert({ ordered_by: userId, type, notes, status: 'pending' }).select().single()
    if (oErr || !order) { setError(oErr?.message ?? 'Erreur'); setSaving(false); return }

    await supabase.from('purchase_order_lines').insert(
      validLines.map(l => ({ order_id: order.id, product_id: parseInt(l.product_id), qty_ordered: parseFloat(l.qty) }))
    )

    const { data: updated } = await supabase.from('purchase_orders')
      .select('*, lines:purchase_order_lines(*, product:products(name, unit))')
      .eq('ordered_by', userId).order('order_date', { ascending: false }).limit(20)
    setOrders(updated ?? [])
    setLines([{ product_id: '', qty: '' }])
    setNotes('')
    setSuccess(true)
    setSaving(false)
    setTimeout(() => setSuccess(false), 4000)
  }

  const handleReceive = async (order: OrderRecord) => {
    setProcessing(order.id)
    const month = currentMonth()
    for (const line of order.lines) {
      const qty = line.qty_received ?? line.qty_ordered
      if (qty <= 0) continue
      const product = products.find(p => p.name === line.product?.name)
      if (!product) continue

      await supabase.from('stock_months').upsert(
        { product_id: product.id, month, bought: 0, opening_stock: 0, used: 0 },
        { onConflict: 'product_id,month', ignoreDuplicates: true }
      )
      const { data: sm } = await supabase.from('stock_months').select('bought')
        .eq('product_id', product.id).eq('month', month).single()
      await supabase.from('stock_months').update({ bought: (sm?.bought ?? 0) + qty })
        .eq('product_id', product.id).eq('month', month)
    }
    await supabase.from('purchase_orders').update({ status: 'received' }).eq('id', order.id)
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'received' } : o))
    setProcessing(null)
  }

  const handleCancel = async (orderId: number) => {
    setProcessing(orderId)
    await supabase.from('purchase_orders').update({ status: 'cancelled' }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o))
    setProcessing(null)
  }

  return (
    <div className="space-y-6 w-full max-w-4xl">
      <Card>
        <CardHeader><CardTitle>Nouvelle commande</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {success && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              Commande soumise avec succès.
            </div>
          )}
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type de produit</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Produits à commander</Label>
              <Button type="button" variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Ajouter</Button>
            </div>
            {lines.map((line, i) => {
              const sel = getSelectedProduct(line.product_id)
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <select
                      value={line.product_id}
                      onChange={e => updateLine(i, 'product_id', e.target.value)}
                      className="flex-1 h-9 rounded-md border border-[#E5E2D8] bg-white px-3 text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#602460]/30 focus:border-[#602460]"
                    >
                      <option value="">Sélectionner un produit…</option>
                      {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                    </select>
                    <Input type="number" placeholder="Qté" value={line.qty}
                      onChange={e => updateLine(i, 'qty', e.target.value)} className="w-24" min="0" step="0.1" />
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    )}
                  </div>
                  {sel && (
                    <div className="flex items-center gap-3 pl-1 text-[11px] text-[#B0A5B4]">
                      {sel.price_excl_tax != null && (
                        <span>Prix: <span className="font-semibold text-sky-600">{formatCurrency(sel.price_excl_tax)}</span></span>
                      )}
                      {sel.packaging_desc && (
                        <span>Cond.: <span className="font-semibold text-[#3D1640]">{sel.packaging_desc}</span></span>
                      )}
                      <span>Unité: <span className="font-semibold text-[#3D1640]">{sel.unit}</span></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optionnel)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Fournisseur, délai, urgence…" rows={2} />
          </div>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Soumission…' : 'Soumettre la commande'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mes commandes récentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <p className="px-5 py-4 text-sm text-[#B0A5B4]">Aucune commande.</p>
          ) : (
            <div className="divide-y divide-[#E5E2D8]">
              {orders.map(o => {
                const isPending = o.status === 'pending'
                const isOpen = expanded.includes(o.id)
                return (
                  <div key={o.id}>
                    <div
                      className={`flex items-center justify-between px-5 py-3 ${isPending ? 'cursor-pointer hover:bg-[#F9F7F4] transition-colors' : ''}`}
                      onClick={() => isPending && toggleExpand(o.id)}
                    >
                      <div className="flex items-center gap-3">
                        {isPending && (
                          isOpen
                            ? <ChevronDown size={14} className="text-[#602460]" />
                            : <ChevronRight size={14} className="text-[#B0A5B4]" />
                        )}
                        <div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-[#3D1640] font-medium">{formatDate(o.order_date)}</span>
                            <span className="text-[#B0A5B4]">·</span>
                            <span className="text-[#7B6B80]">{TYPE_LABELS[o.type] ?? o.type}</span>
                            <span className="text-[#B0A5B4]">·</span>
                            <span className="font-mono text-[#B0A5B4] text-xs">{o.lines?.length ?? 0} ligne(s)</span>
                          </div>
                          {o.notes && <p className="text-[11px] text-[#B0A5B4] mt-0.5 italic">{o.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[o.status] ?? 'default'}>
                          {o.status === 'pending' ? 'En attente' : o.status === 'received' ? 'Reçue' : 'Annulée'}
                        </Badge>
                      </div>
                    </div>

                    {isOpen && isPending && (
                      <div className="border-t border-[#E5E2D8] bg-[#FAFAF8]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produit</TableHead>
                              <TableHead>Qté commandée</TableHead>
                              <TableHead>Unité</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {o.lines.map((line, i) => (
                              <TableRow key={i}>
                                <TableCell>{line.product?.name ?? '—'}</TableCell>
                                <TableCell className="font-mono text-[#7B6B80]">{line.qty_ordered}</TableCell>
                                <TableCell className="font-mono text-xs text-[#B0A5B4]">{line.product?.unit ?? ''}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="flex items-center gap-2 px-4 py-3">
                          <Button variant="danger" size="sm"
                            onClick={e => { e.stopPropagation(); handleCancel(o.id) }} disabled={processing === o.id}>
                            <X size={14} /> Annuler
                          </Button>
                          <Button size="sm"
                            onClick={e => { e.stopPropagation(); handleReceive(o) }} disabled={processing === o.id}>
                            <Check size={14} /> Marquer reçue → Stock
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
