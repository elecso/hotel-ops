'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Product, Supplier, ProductCategory, RoomType } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  product: Product
  suppliers: Supplier[]
  categories: ProductCategory[]
  roomTypes?: RoomType[]
}

export function EditProductModal({ open, onClose, onSaved, product, suppliers, categories, roomTypes = [] }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', sku: '', supplier_id: '', category_id: '',
    unit: '', packaging_desc: '', packaging_qty: '',
    price_excl_tax: '', min_stock: '', delivery_days: '',
    purchase_url: '', hotel_scope: 'both' as 'mercure' | 'ibis' | 'both',
    coefficient: '',
  })

  const [selectedRoomTypes, setSelectedRoomTypes] = useState<number[]>([])
  const [localRoomTypes, setLocalRoomTypes] = useState<RoomType[]>(roomTypes)

  // Inline creation state
  const [localSuppliers, setLocalSuppliers] = useState(suppliers)
  const [localCategories, setLocalCategories] = useState(categories)
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => {
    setLocalSuppliers(suppliers)
    setLocalCategories(categories)
  }, [suppliers, categories])

  // Fetch room types directly when modal opens for room/laundry products
  useEffect(() => {
    if (open && (product.type === 'room' || product.type === 'laundry')) {
      supabase.from('room_types').select('*').order('hotel_id, code').then(({ data }) => {
        if (data) setLocalRoomTypes(data)
      })
    }
  }, [open, product.type])

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name ?? '',
        sku: product.sku ?? '',
        supplier_id: product.supplier_id ? String(product.supplier_id) : '',
        category_id: product.category_id ? String(product.category_id) : '',
        unit: product.unit ?? '',
        packaging_desc: product.packaging_desc ?? '',
        packaging_qty: product.packaging_qty ? String(product.packaging_qty) : '',
        price_excl_tax: product.price_excl_tax ? String(product.price_excl_tax) : '',
        min_stock: product.min_stock ? String(product.min_stock) : '',
        delivery_days: product.delivery_days ? String(product.delivery_days) : '',
        purchase_url: product.purchase_url ?? '',
        hotel_scope: product.hotel_scope ?? 'both',
        coefficient: product.coefficient ? String(product.coefficient) : '',
      })
      setSelectedRoomTypes((product.room_typologies ?? []).map(r => r.room_type_id))
    }
  }, [product])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const toggleRoomType = (id: number) =>
    setSelectedRoomTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const filteredRoomTypes = form.hotel_scope !== 'both'
    ? localRoomTypes.filter(rt => rt.hotel_id === form.hotel_scope)
    : localRoomTypes

  const handleCreateSupplier = async () => {
    if (!newSupplierName) return
    const { data } = await supabase.from('suppliers').insert({ name: newSupplierName }).select().single()
    if (data) {
      setLocalSuppliers(prev => [...prev, data])
      setForm(f => ({ ...f, supplier_id: String(data.id) }))
      setNewSupplierName('')
      setShowNewSupplier(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName) return
    const { data } = await supabase.from('product_categories').insert({ name: newCategoryName, type: product.type }).select().single()
    if (data) {
      setLocalCategories(prev => [...prev, data])
      setForm(f => ({ ...f, category_id: String(data.id) }))
      setNewCategoryName('')
      setShowNewCategory(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const { error: pErr } = await supabase.from('products').update({
        name: form.name,
        sku: form.sku || null,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        unit: form.unit || null,
        packaging_desc: form.packaging_desc || null,
        packaging_qty: form.packaging_qty ? parseFloat(form.packaging_qty) : null,
        price_excl_tax: form.price_excl_tax ? parseFloat(form.price_excl_tax) : null,
        min_stock: form.min_stock ? parseFloat(form.min_stock) : null,
        delivery_days: form.delivery_days ? parseInt(form.delivery_days) : null,
        purchase_url: form.purchase_url || null,
        hotel_scope: form.hotel_scope,
        coefficient: form.coefficient ? parseFloat(form.coefficient) : null,
      }).eq('id', product.id)

      if (pErr) throw pErr

      if (product.type === 'room' || product.type === 'laundry') {
        const res = await fetch('/api/inventory/room-typologies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: product.id, room_type_ids: selectedRoomTypes }),
        })
        if (!res.ok) {
          const { error: rtErr } = await res.json()
          throw new Error(rtErr ?? 'Erreur mise à jour typologies')
        }
      }

      onSaved()
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le produit</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Nom *</Label>
              <Input value={form.name} onChange={set('name')} />
            </div>
            <div className="space-y-1.5">
              <Label>SKU / Référence</Label>
              <Input value={form.sku} onChange={set('sku')} />
            </div>

            {/* Fournisseur with inline creation */}
            <div className="space-y-1.5">
              <Label>Fournisseur</Label>
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <Select value={form.supplier_id} onValueChange={v => setForm(f => ({ ...f, supplier_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {localSuppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewSupplier(v => !v)}
                  className="h-9 w-9 flex items-center justify-center rounded-md border border-[#E5E2D8] bg-[#F4F2ED] text-[#602460] hover:bg-[#602460]/10 hover:border-[#602460]/40 transition-colors text-lg font-bold"
                  title="Nouveau fournisseur"
                >+</button>
              </div>
              {showNewSupplier && (
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    placeholder="Nom du fournisseur"
                    value={newSupplierName}
                    onChange={e => setNewSupplierName(e.target.value)}
                    className="flex-1 h-8 text-xs"
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateSupplier() }}
                  />
                  <Button type="button" size="sm" className="h-8 text-xs" disabled={!newSupplierName} onClick={handleCreateSupplier}>
                    Créer
                  </Button>
                </div>
              )}
            </div>

            {/* Catégorie with inline creation */}
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {localCategories.filter(c => c.type === product.type).map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewCategory(v => !v)}
                  className="h-9 w-9 flex items-center justify-center rounded-md border border-[#E5E2D8] bg-[#F4F2ED] text-[#602460] hover:bg-[#602460]/10 hover:border-[#602460]/40 transition-colors text-lg font-bold"
                  title="Nouvelle catégorie"
                >+</button>
              </div>
              {showNewCategory && (
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    placeholder="Nom de la catégorie"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className="flex-1 h-8 text-xs"
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory() }}
                  />
                  <Button type="button" size="sm" className="h-8 text-xs" disabled={!newCategoryName} onClick={handleCreateCategory}>
                    Créer
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Unité</Label>
              <Input value={form.unit} onChange={set('unit')} />
            </div>
            <div className="space-y-1.5">
              <Label>Conditionnement</Label>
              <Input value={form.packaging_desc} onChange={set('packaging_desc')} />
            </div>
            <div className="space-y-1.5">
              <Label>Qté par cond.</Label>
              <Input type="number" value={form.packaging_qty} onChange={set('packaging_qty')} />
            </div>
            <div className="space-y-1.5">
              <Label>Prix HT (€)</Label>
              <Input type="number" value={form.price_excl_tax} onChange={set('price_excl_tax')} step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label>Stock minimum</Label>
              <Input type="number" value={form.min_stock} onChange={set('min_stock')} />
            </div>
            <div className="space-y-1.5">
              <Label>Délai livraison (jours)</Label>
              <Input type="number" value={form.delivery_days} onChange={set('delivery_days')} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>URL commande</Label>
              <Input value={form.purchase_url} onChange={set('purchase_url')} type="url" />
            </div>
            <div className="space-y-1.5">
              <Label>Portée hôtel</Label>
              <Select value={form.hotel_scope} onValueChange={v => setForm(f => ({ ...f, hotel_scope: v as 'mercure' | 'ibis' | 'both' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mercure">Mercure</SelectItem>
                  <SelectItem value="ibis">Ibis</SelectItem>
                  <SelectItem value="both">Les deux</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {product.type === 'laundry' && (
              <div className="space-y-1.5">
                <Label>Coefficient (par chambre)</Label>
                <Input type="number" value={form.coefficient} onChange={set('coefficient')} placeholder="ex: 2" step="0.01" />
              </div>
            )}
          </div>

          {(product.type === 'room' || product.type === 'laundry') && (
            <div className="space-y-2">
              <Label>Typologies de chambre</Label>
              {filteredRoomTypes.length === 0 ? (
                <p className="text-xs text-[#B0A5B4]">Aucun type de chambre disponible.</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredRoomTypes.map(rt => (
                    <label
                      key={rt.id}
                      className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md border border-[#E5E2D8] hover:bg-[#F4F2ED] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoomTypes.includes(rt.id)}
                        onChange={() => toggleRoomType(rt.id)}
                        className="w-4 h-4 accent-[#602460]"
                      />
                      <span className="text-xs text-[#3D1640]">{rt.code} — {rt.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !form.name}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
