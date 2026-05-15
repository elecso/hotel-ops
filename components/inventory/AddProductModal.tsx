'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ProductType, Supplier, ProductCategory, RoomType } from '@/lib/types'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (product?: { id: number; name: string }) => void
  type?: ProductType
  defaultName?: string
  suppliers: Supplier[]
  categories: ProductCategory[]
  roomTypes?: RoomType[]
}

interface SubProductDraft {
  name: string
  volume_cl: string
  decrement_factor: string
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  beverage: 'Boissons',
  food: 'Alimentation',
  ingredient: 'Ingrédients',
  room: 'Chambres',
  cleaning_fb: 'Hygiène F&B',
  cleaning_general: 'Hygiène Général',
  meeting: 'Séminaires',
  laundry: 'Linge',
}

export function AddProductModal({ open, onClose, onSaved, type: typeProp, defaultName = '', suppliers, categories, roomTypes = [] }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedType, setSelectedType] = useState<ProductType>(typeProp ?? 'beverage')
  const type = typeProp ?? selectedType

  const [form, setForm] = useState({
    name: defaultName, sku: '', supplier_id: '', category_id: '',
    unit: '', packaging_desc: '', packaging_qty: '',
    price_excl_tax: '', min_stock: '', delivery_days: '',
    purchase_url: '', hotel_scope: 'both' as 'mercure' | 'ibis' | 'both',
  })

  const [selectedRoomTypes, setSelectedRoomTypes] = useState<number[]>([])
  const [subProducts, setSubProducts] = useState<SubProductDraft[]>([])

  const [localSuppliers, setLocalSuppliers] = useState(suppliers)
  const [localCategories, setLocalCategories] = useState(categories)
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')

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
    const { data } = await supabase.from('product_categories').insert({ name: newCategoryName, type }).select().single()
    if (data) {
      setLocalCategories(prev => [...prev, data])
      setForm(f => ({ ...f, category_id: String(data.id) }))
      setNewCategoryName('')
      setShowNewCategory(false)
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const toggleRoomType = (id: number) =>
    setSelectedRoomTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const addSubProduct = () =>
    setSubProducts(prev => [...prev, { name: '', volume_cl: '', decrement_factor: '' }])

  const updateSubProduct = (i: number, key: keyof SubProductDraft, val: string) =>
    setSubProducts(prev => prev.map((sp, idx) => idx === i ? { ...sp, [key]: val } : sp))

  const removeSubProduct = (i: number) =>
    setSubProducts(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const { data: product, error: pErr } = await supabase.from('products').insert({
        name: form.name,
        sku: form.sku || null,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        type,
        unit: form.unit || null,
        packaging_desc: form.packaging_desc || null,
        packaging_qty: form.packaging_qty ? parseFloat(form.packaging_qty) : null,
        price_excl_tax: form.price_excl_tax ? parseFloat(form.price_excl_tax) : null,
        min_stock: form.min_stock ? parseFloat(form.min_stock) : null,
        delivery_days: form.delivery_days ? parseInt(form.delivery_days) : null,
        purchase_url: form.purchase_url || null,
        hotel_scope: form.hotel_scope,
      }).select().single()

      if (pErr) throw pErr
      const createdProduct = product

      if (type === 'room' && selectedRoomTypes.length > 0) {
        await supabase.from('product_room_typologies').insert(
          selectedRoomTypes.map(rt => ({ product_id: product.id, room_type_id: rt }))
        )
      }

      if (type === 'beverage' && subProducts.length > 0) {
        await supabase.from('beverage_sub_products').insert(
          subProducts.map(sp => ({
            parent_product_id: product.id,
            name: sp.name,
            volume_cl: sp.volume_cl ? parseFloat(sp.volume_cl) : null,
            decrement_factor: sp.decrement_factor ? parseFloat(sp.decrement_factor) : null,
          }))
        )
      }

      onSaved({ id: createdProduct.id, name: createdProduct.name })
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  const VIN_SUB_PRODUCTS: SubProductDraft[] = [
    { name: 'Pichet 50CL', volume_cl: '50', decrement_factor: '0.66' },
    { name: 'Pichet 25CL', volume_cl: '25', decrement_factor: '0.33' },
    { name: 'Verre 15CL',  volume_cl: '15', decrement_factor: '0.2'  },
    { name: 'Verre 8CL',   volume_cl: '8',  decrement_factor: '0.1'  },
  ]

  const handleCategoryChange = (v: string) => {
    setForm(f => ({ ...f, category_id: v }))
    if (type === 'beverage') {
      const cat = localCategories.find(c => String(c.id) === v)
      if (cat?.name?.toLowerCase().includes('vin')) {
        setSubProducts(VIN_SUB_PRODUCTS)
      }
    }
  }

  const filteredRoomTypes = type === 'room' && form.hotel_scope !== 'both'
    ? roomTypes.filter(rt => rt.hotel_id === form.hotel_scope)
    : roomTypes

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un produit</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            {!typeProp && (
              <div className="col-span-2 space-y-1.5">
                <Label>Type de produit *</Label>
                <Select value={selectedType} onValueChange={v => setSelectedType(v as ProductType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label>Nom *</Label>
              <Input value={form.name} onChange={set('name')} placeholder="Nom du produit" />
            </div>
            <div className="space-y-1.5">
              <Label>SKU / Référence</Label>
              <Input value={form.sku} onChange={set('sku')} placeholder="REF-001" />
            </div>

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
                  <Button type="button" size="sm" className="h-8 text-xs" disabled={!newSupplierName} onClick={handleCreateSupplier}>Créer</Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <Select value={form.category_id} onValueChange={handleCategoryChange}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {localCategories.filter(c => c.type === type).map(c => (
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
                  <Button type="button" size="sm" className="h-8 text-xs" disabled={!newCategoryName} onClick={handleCreateCategory}>Créer</Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Unité</Label>
              <Input value={form.unit} onChange={set('unit')} placeholder="pcs, kg, L..." />
            </div>
            <div className="space-y-1.5">
              <Label>Conditionnement (description)</Label>
              <Input value={form.packaging_desc} onChange={set('packaging_desc')} placeholder="Carton 24 pcs" />
            </div>
            <div className="space-y-1.5">
              <Label>Qté par cond.</Label>
              <Input type="number" value={form.packaging_qty} onChange={set('packaging_qty')} placeholder="24" />
            </div>
            <div className="space-y-1.5">
              <Label>Prix HT (€)</Label>
              <Input type="number" value={form.price_excl_tax} onChange={set('price_excl_tax')} placeholder="0.00" step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label>Stock minimum</Label>
              <Input type="number" value={form.min_stock} onChange={set('min_stock')} placeholder="10" />
            </div>
            <div className="space-y-1.5">
              <Label>Délai livraison (jours)</Label>
              <Input type="number" value={form.delivery_days} onChange={set('delivery_days')} placeholder="3" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>URL commande</Label>
              <Input value={form.purchase_url} onChange={set('purchase_url')} placeholder="https://..." type="url" />
            </div>
            {(type === 'room') && (
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
            )}
          </div>

          {type === 'room' && filteredRoomTypes.length > 0 && (
            <div className="space-y-2">
              <Label>Typologies de chambre</Label>
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
            </div>
          )}

          {type === 'beverage' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sous-produits (verres, pichets…)</Label>
                <Button type="button" variant="secondary" size="sm" onClick={addSubProduct}>
                  <Plus size={14} /> Ajouter
                </Button>
              </div>
              {subProducts.map((sp, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-[#E5E2D8] bg-[#F9F7F4]">
                  <Input placeholder="Nom (ex: Verre 25cl)" value={sp.name} onChange={e => updateSubProduct(i, 'name', e.target.value)} className="flex-1" />
                  <Input placeholder="Volume (cl)" value={sp.volume_cl} onChange={e => updateSubProduct(i, 'volume_cl', e.target.value)} type="number" className="w-24" />
                  <Input placeholder="Facteur" value={sp.decrement_factor} onChange={e => updateSubProduct(i, 'decrement_factor', e.target.value)} type="number" step="0.01" className="w-24" />
                  <button onClick={() => removeSubProduct(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
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
