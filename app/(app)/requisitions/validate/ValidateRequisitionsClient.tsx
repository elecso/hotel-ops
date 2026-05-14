'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDate, currentMonth } from '@/lib/utils'

interface ReqLine {
  id: number; product_id: number; qty_requested: number; qty_validated: number | null
  product: { id: number; name: string; unit: string } | null
}
interface Requisition {
  id: number; request_date: string; type: string; notes: string; status: string
  requester: { full_name: string; role: string } | null; lines: ReqLine[]
}
const TYPE_LABELS: Record<string, string> = {
  room: 'Chambre', beverage: 'Boisson', food: 'Alimentation',
  cleaning_fb: 'Nettoyage F&B', cleaning_general: 'Nettoyage général',
  meeting: 'Réunion', laundry: 'Blanchisserie',
}

export function ValidateRequisitionsClient({ requisitions: initial }: { requisitions: Requisition[] }) {
  const [requisitions, setRequisitions] = useState(initial)
  const [expanded, setExpanded] = useState<number[]>([])
  const [lineQty, setLineQty] = useState<Record<number, string>>({})
  const [processing, setProcessing] = useState<number | null>(null)
  const supabase = createClient()

  const toggleExpand = (id: number) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const getQty = (line: ReqLine) =>
    lineQty[line.id] !== undefined ? lineQty[line.id] : String(line.qty_requested)

  const handleApprove = async (req: Requisition) => {
    setProcessing(req.id)
    const month = currentMonth()
    for (const line of req.lines) {
      const qtyVal = parseFloat(getQty(line))
      if (isNaN(qtyVal) || qtyVal <= 0) continue
      await supabase.from('requisition_lines').update({ qty_validated: qtyVal }).eq('id', line.id)
      if (line.product_id) {
        // Ensure stock_months row exists
        await supabase.from('stock_months').upsert(
          { product_id: line.product_id, month, bought: 0, opening_stock: 0, used: 0 },
          { onConflict: 'product_id,month', ignoreDuplicates: true }
        )
        // Decrease stock by incrementing "used"
        const { data: sm } = await supabase.from('stock_months').select('used')
          .eq('product_id', line.product_id).eq('month', month).single()
        await supabase.from('stock_months').update({ used: (sm?.used ?? 0) + qtyVal })
          .eq('product_id', line.product_id).eq('month', month)
      }
    }
    await supabase.from('requisitions').update({ status: 'validated' }).eq('id', req.id)
    setRequisitions(prev => prev.filter(r => r.id !== req.id))
    setProcessing(null)
  }

  const handleReject = async (reqId: number) => {
    setProcessing(reqId)
    await supabase.from('requisitions').update({ status: 'rejected' }).eq('id', reqId)
    setRequisitions(prev => prev.filter(r => r.id !== reqId))
    setProcessing(null)
  }

  if (requisitions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-[#B0A5B4]">Aucune réquisition en attente de validation.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 w-full max-w-4xl">
      {requisitions.map(req => {
        const isOpen = expanded.includes(req.id)
        return (
          <Card key={req.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <button onClick={() => toggleExpand(req.id)} className="flex items-center gap-3 flex-1 text-left">
                  {isOpen
                    ? <ChevronDown size={16} className="text-[#602460]" />
                    : <ChevronRight size={16} className="text-[#B0A5B4]" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>{req.requester?.full_name ?? 'Utilisateur'}</CardTitle>
                      <Badge variant="pending">En attente</Badge>
                    </div>
                    <p className="text-xs mt-0.5 text-[#B0A5B4]">
                      {formatDate(req.request_date)} — {TYPE_LABELS[req.type] ?? req.type} — {req.lines.length} ligne(s)
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <Button variant="danger" size="sm" onClick={() => handleReject(req.id)} disabled={processing === req.id}>
                    <X size={14} /> Rejeter
                  </Button>
                  <Button size="sm" onClick={() => handleApprove(req)} disabled={processing === req.id}>
                    <Check size={14} /> Approuver
                  </Button>
                </div>
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent className="p-0">
                {req.notes && (
                  <div className="px-5 pb-2">
                    <p className="text-xs italic text-[#B0A5B4]">Note: {req.notes}</p>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead><TableHead>Demandé</TableHead>
                      <TableHead>Qté validée</TableHead><TableHead>Unité</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {req.lines.map(line => (
                      <TableRow key={line.id}>
                        <TableCell>{line.product?.name ?? '—'}</TableCell>
                        <TableCell className="font-mono text-[#7B6B80]">{line.qty_requested}</TableCell>
                        <TableCell>
                          <Input type="number" value={getQty(line)}
                            onChange={e => setLineQty(prev => ({ ...prev, [line.id]: e.target.value }))}
                            className="h-7 w-20 text-xs" min="0" step="0.1" />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-[#B0A5B4]">{line.product?.unit ?? ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
