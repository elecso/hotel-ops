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
import { Plus, Trash2, ClipboardCheck } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
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

interface Requisition {
  id: number
  request_date: string
  status: string
  type: string
  notes: string
  lines: { id: number; product: { name: string; unit: string } | null; qty_requested: number; qty_validated: number }[]
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
  const supabase = createClient()

  const filteredProducts = products.filter(p => !type || p.type === type)
  const canValidate = role === 'admin' || role === 'manager'

  const addLine = () => setLines(prev => [...prev, { product_id: '', qty: '' }])
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))
  const updateLine = (i: number, key: keyof ReqLine, val: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l))

  const getSelectedProduct = (productId: string) =>
    products.find(p => String(p.id) === productId)

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    const validLines = lines.filter(l => l.product_id && l.qty && parseFloat(l.qty) > 0)
    if (validLines.length === 0) { setError('Ajoutez au moins une ligne.'); setSaving(false); return }

    const { data: req, error: rErr } = await supabase
      .from('requisitions')
      .insert({ requested_by: userId, type, notes, status: 'pending' })
      .select()
      .single()

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
      {/* Link to validation page for admin/manager */}
      {canValidate && (
        <Link href="/requisitions/validate">
          <Button variant="secondary" className="flex items-center gap-2">
            <ClipboardCheck size={16} />
            Valider les réquisitions en attente
          </Button>
        </Link>
      )}

      {/* Create form */}
      <Card>
        <CardHeader><CardTitle>Nouvelle réquisition</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {success && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              Réquisition soumise avec succès.
            </div>
          )}
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

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
                      className="flex-1 h-9 rounded-[6px] border border-[#C5C0B1] bg-white px-3 text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#7E3A7E]"
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
                      <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {/* Product details */}
                  {selectedProduct && (
                    <div className="flex items-center gap-3 pl-1 text-[11px]" style={{ color: '#C5C0B1' }}>
                      {selectedProduct.price_excl_tax != null && (
                        <span>Prix: <span className="font-semibold text-[#602460]">{formatCurrency(selectedProduct.price_excl_tax)}</span></span>
                      )}
                      {selectedProduct.packaging_desc && (
                        <span>Cond.: <span className="font-semibold text-[#3D1640]">{selectedProduct.packaging_desc}</span></span>
                      )}
                      <span>Unité: <span className="font-semibold text-[#3D1640]">{selectedProduct.unit}</span></span>
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

      {/* History */}
      <Card>
        <CardHeader><CardTitle>Mes réquisitions récentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          {requisitions.length === 0 ? (
            <p className="px-5 py-4 text-sm" style={{ color: '#C5C0B1' }}>Aucune réquisition.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lignes</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.request_date)}</TableCell>
                    <TableCell>{TYPE_LABELS[r.type] ?? r.type}</TableCell>
                    <TableCell className="font-mono">{r.lines?.length ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>
                        {r.status === 'pending' ? 'En attente' : r.status === 'validated' ? 'Validée' : 'Rejetée'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
