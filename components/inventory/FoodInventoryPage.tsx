'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const OUTLETS = ['lunch', 'dinner', 'bar', 'room_service', 'banquet', 'epicerie'] as const
const OUTLET_LABELS: Record<string, string> = {
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  bar: 'Bar',
  room_service: 'Room Service',
  banquet: 'Banquet',
  epicerie: "L'Épicerie",
}

export interface FoodMenuRow {
  id: number
  name: string
  outlet: string
  sales_mtd: number
}

interface Props {
  rows: FoodMenuRow[]
  isAdmin: boolean
  monthLabel: string
}

export function FoodInventoryPage({ rows: rowsProp, isAdmin, monthLabel }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<FoodMenuRow[]>(rowsProp)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<FoodMenuRow | null>(null)
  const [formName, setFormName] = useState('')
  const [formOutlet, setFormOutlet] = useState('lunch')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (id: number) => {
    if (!confirm('Désactiver cet article ?')) return
    setDeletingId(id)
    await supabase.from('menu_items').update({ is_active: false }).eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
    setDeletingId(null)
  }

  const openAdd = () => { setFormName(''); setFormOutlet('lunch'); setError(''); setShowAdd(true) }
  const openEdit = (row: FoodMenuRow) => { setEditItem(row); setFormName(row.name); setFormOutlet(row.outlet ?? 'lunch') }

  const handleAdd = async () => {
    if (!formName.trim()) return
    setSaving(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('menu_items')
        .insert({ name: formName.trim(), outlet: formOutlet, is_active: true })
        .select('id, name, outlet')
        .single()
      if (err) throw err
      if (data) {
        setRows(prev => [...prev, { id: data.id, name: data.name, outlet: data.outlet, sales_mtd: 0 }]
          .sort((a, b) => a.name.localeCompare(b.name, 'fr')))
      }
      setShowAdd(false)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editItem || !formName.trim()) return
    setSaving(true)
    setError('')
    try {
      const { error: err } = await supabase
        .from('menu_items')
        .update({ name: formName.trim(), outlet: formOutlet })
        .eq('id', editItem.id)
      if (err) throw err
      setRows(prev => prev.map(r => r.id === editItem.id ? { ...r, name: formName.trim(), outlet: formOutlet } : r))
      setEditItem(null)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const OutletForm = () => (
    <div className="px-6 py-4 space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      <div className="space-y-1.5">
        <Label>Nom *</Label>
        <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Plat du jour" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label>Outlet</Label>
        <Select value={formOutlet} onValueChange={setFormOutlet}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {OUTLETS.map(o => <SelectItem key={o} value={o}>{OUTLET_LABELS[o]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#B0A5B4]">Ventes mois en cours — {monthLabel}</p>
        {isAdmin && (
          <Button onClick={openAdd}><Plus size={16} /> Ajouter un article</Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E2D8] overflow-hidden">
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
          Alimentation — suivi des ventes via F&B Upload. Pas de gestion de stock direct.
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plat / Article</TableHead>
              <TableHead className="text-right">Ventes ce mois</TableHead>
              {isAdmin && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-[#B0A5B4] py-10">
                  Aucun article. Ajoutez-en via le bouton ci-dessus ou créez-en lors d&apos;un F&B Upload.
                </TableCell>
              </TableRow>
            ) : rows.map(row => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-sm text-[#3D1640]">{row.name}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {row.sales_mtd > 0
                    ? <span className="text-[#602460] font-semibold">{row.sales_mtd}</span>
                    : <span className="text-[#C5C0B1]">0</span>
                  }
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(row)}
                        className="text-[#B0A5B4] hover:text-[#602460] p-1 rounded hover:bg-[#602460]/10 transition-colors"
                        title="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className="text-[#B0A5B4] hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors disabled:opacity-40"
                        title="Désactiver"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={o => !o && setShowAdd(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ajouter un article</DialogTitle></DialogHeader>
          <OutletForm />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={saving || !formName.trim()}>
              {saving ? 'Enregistrement…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={o => !o && setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Modifier l&apos;article</DialogTitle></DialogHeader>
          <OutletForm />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditItem(null)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={saving || !formName.trim()}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
