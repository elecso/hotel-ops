'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

interface Supplier { id: number; name: string }
interface Category { id: number; name: string; type: string }
interface SubProductDraft { name: string; volume_cl: string; decrement_factor: string }
export interface FbMenuItem { id: number; name: string; outlet: string; recipe_id: number | null }
export interface FbBeverageProduct { id: number; name: string; unit: string; sub_products: { id: number; name: string; decrement_factor: number }[] }

interface Props {
  open: boolean
  lineIdx: number
  defaultName: string
  onClose: () => void
  onCreatedMenuItem: (lineIdx: number, item: FbMenuItem) => void
  onCreatedBeverage: (lineIdx: number, bev: FbBeverageProduct) => void
}

const OUTLETS = ['lunch', 'dinner', 'bar', 'room_service', 'banquet', 'epicerie'] as const
const OUTLET_LABELS: Record<string, string> = {
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  bar: 'Bar',
  room_service: 'Room Service',
  banquet: 'Banquet',
  epicerie: "L'Épicerie",
}

const VIN_SUB_PRODUCTS: SubProductDraft[] = [
  { name: 'Pichet 50CL', volume_cl: '50', decrement_factor: '0.66' },
  { name: 'Pichet 25CL', volume_cl: '25', decrement_factor: '0.33' },
  { name: 'Verre 15CL',  volume_cl: '15', decrement_factor: '0.2'  },
  { name: 'Verre 8CL',   volume_cl: '8',  decrement_factor: '0.1'  },
]

const EMPTY_BEV_FORM = {
  name: '', sku: '', supplier_id: '', category_id: '',
  unit: '', packaging_desc: '', packaging_qty: '',
  price_excl_tax: '', min_stock: '', delivery_days: '', purchase_url: '',
}

const EMPTY_FOOD_EXTRA = {
  supplier_id: '', category_id: '', unit: '', packaging_desc: '', packaging_qty: '', price_excl_tax: '',
}

export function AddFbProductModal({ open, lineIdx, defaultName, onClose, onCreatedMenuItem, onCreatedBeverage }: Props) {
  const supabase = createClient()
  const [kind, setKind] = useState<'food' | 'beverage'>('food')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  // Food fields
  const [foodName, setFoodName] = useState('')
  const [outlet, setOutlet] = useState('lunch')
  const [foodExtra, setFoodExtra] = useState(EMPTY_FOOD_EXTRA)

  // Beverage fields
  const [bevForm, setBevForm] = useState(EMPTY_BEV_FORM)
  const [subProducts, setSubProducts] = useState<SubProductDraft[]>([])

  // Inline create helpers (shared)
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => {
    if (!open) return
    setFoodName(defaultName)
    setBevForm({ ...EMPTY_BEV_FORM, name: defaultName })
    setFoodExtra(EMPTY_FOOD_EXTRA)
    setKind('food')
    setOutlet('lunch')
    setSubProducts([])
    setError('')
    setShowNewSupplier(false)
    setShowNewCategory(false)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Promise.all([
      supabase.from('suppliers').select('id, name').order('name'),
      supabase.from('product_categories').select('id, name, type').order('name'),
    ]).then(([{ data: sup }, { data: cat }]) => {
      setSuppliers((sup as Supplier[]) ?? [])
      setCategories((cat as Category[]) ?? [])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultName])

  const setBev = (key: keyof typeof EMPTY_BEV_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBevForm(f => ({ ...f, [key]: e.target.value }))

  const setFood = (key: keyof typeof EMPTY_FOOD_EXTRA) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFoodExtra(f => ({ ...f, [key]: e.target.value }))

  const handleBevCategoryChange = (v: string) => {
    setBevForm(f => ({ ...f, category_id: v }))
    const cat = categories.find(c => String(c.id) === v)
    if (cat?.name?.toLowerCase().includes('vin')) setSubProducts(VIN_SUB_PRODUCTS)
  }

  const handleCreateSupplier = async () => {
    if (!newSupplierName) return
    const { data } = await supabase.from('suppliers').insert({ name: newSupplierName }).select().single()
    if (data) {
      setSuppliers(prev => [...prev, data as Supplier])
      if (kind === 'food') setFoodExtra(f => ({ ...f, supplier_id: String(data.id) }))
      else setBevForm(f => ({ ...f, supplier_id: String(data.id) }))
      setNewSupplierName('')
      setShowNewSupplier(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName) return
    const { data } = await supabase.from('product_categories').insert({ name: newCategoryName, type: kind }).select().single()
    if (data) {
      setCategories(prev => [...prev, data as Category])
      if (kind === 'food') setFoodExtra(f => ({ ...f, category_id: String(data.id) }))
      else setBevForm(f => ({ ...f, category_id: String(data.id) }))
      setNewCategoryName('')
      setShowNewCategory(false)
    }
  }

  const addSubProduct = () => setSubProducts(prev => [...prev, { name: '', volume_cl: '', decrement_factor: '' }])
  const updateSubProduct = (i: number, key: keyof SubProductDraft, val: string) =>
    setSubProducts(prev => prev.map((sp, idx) => idx === i ? { ...sp, [key]: val } : sp))
  const removeSubProduct = (i: number) => setSubProducts(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (kind === 'food') {
        if (!foodName.trim()) throw new Error('Le nom est obligatoire')

        // Insert into products table so the item appears in /inventory/food
        await supabase.from('products').insert({
          name: foodName.trim(),
          type: 'food',
          is_active: true,
          supplier_id: foodExtra.supplier_id ? parseInt(foodExtra.supplier_id) : null,
          category_id: foodExtra.category_id ? parseInt(foodExtra.category_id) : null,
          unit: foodExtra.unit || null,
          packaging_desc: foodExtra.packaging_desc || null,
          packaging_qty: foodExtra.packaging_qty ? parseFloat(foodExtra.packaging_qty) : null,
          price_excl_tax: foodExtra.price_excl_tax ? parseFloat(foodExtra.price_excl_tax) : null,
        })

        // Insert into menu_items so F&B upload can map sales to it
        const { data } = await supabase
          .from('menu_items')
          .insert({ name: foodName.trim(), outlet, is_active: true })
          .select('id, name, outlet, recipe_id')
          .single()
        if (data) onCreatedMenuItem(lineIdx, data as FbMenuItem)
      } else {
        if (!bevForm.name.trim()) throw new Error('Le nom est obligatoire')
        const { data: product, error: pErr } = await supabase.from('products').insert({
          name: bevForm.name,
          sku: bevForm.sku || null,
          supplier_id: bevForm.supplier_id ? parseInt(bevForm.supplier_id) : null,
          category_id: bevForm.category_id ? parseInt(bevForm.category_id) : null,
          type: 'beverage',
          unit: bevForm.unit || null,
          packaging_desc: bevForm.packaging_desc || null,
          packaging_qty: bevForm.packaging_qty ? parseFloat(bevForm.packaging_qty) : null,
          price_excl_tax: bevForm.price_excl_tax ? parseFloat(bevForm.price_excl_tax) : null,
          min_stock: bevForm.min_stock ? parseFloat(bevForm.min_stock) : null,
          delivery_days: bevForm.delivery_days ? parseInt(bevForm.delivery_days) : null,
          purchase_url: bevForm.purchase_url || null,
        }).select().single()
        if (pErr) throw pErr

        let spData: { id: number; name: string; decrement_factor: number }[] = []
        if (subProducts.length > 0) {
          const { data: sp } = await supabase.from('beverage_sub_products').insert(
            subProducts.map(sp => ({
              parent_product_id: product.id,
              name: sp.name,
              volume_cl: sp.volume_cl ? parseFloat(sp.volume_cl) : null,
              decrement_factor: sp.decrement_factor ? parseFloat(sp.decrement_factor) : null,
            }))
          ).select('id, name, decrement_factor')
          spData = (sp ?? []) as typeof spData
        }

        onCreatedBeverage(lineIdx, {
          id: product.id,
          name: product.name,
          unit: product.unit ?? '',
          sub_products: spData,
        })
      }
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  const canSave = kind === 'food' ? !!foodName.trim() : !!bevForm.name.trim()
  const foodCategories = categories.filter(c => c.type === 'food')
  const bevCategories = categories.filter(c => c.type === 'beverage')

  const SupplierSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="space-y-1.5">
      <Label>Fournisseur</Label>
      <div className="flex items-center gap-1">
        <div className="flex-1">
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
            <SelectContent>
              {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <button type="button" onClick={() => setShowNewSupplier(v => !v)}
          className="h-9 w-9 flex items-center justify-center rounded-md border border-[#E5E2D8] bg-[#F4F2ED] text-[#602460] hover:bg-[#602460]/10 transition-colors text-lg font-bold"
          title="Nouveau fournisseur">+</button>
      </div>
      {showNewSupplier && (
        <div className="flex items-center gap-1 mt-1">
          <Input placeholder="Nom du fournisseur" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)}
            className="flex-1 h-8 text-xs" onKeyDown={e => { if (e.key === 'Enter') handleCreateSupplier() }} />
          <Button type="button" size="sm" className="h-8 text-xs" disabled={!newSupplierName} onClick={handleCreateSupplier}>Créer</Button>
        </div>
      )}
    </div>
  )

  const CategorySelect = ({ value, onChange, cats }: { value: string; onChange: (v: string) => void; cats: Category[] }) => (
    <div className="space-y-1.5">
      <Label>Catégorie</Label>
      <div className="flex items-center gap-1">
        <div className="flex-1">
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
            <SelectContent>
              {cats.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <button type="button" onClick={() => setShowNewCategory(v => !v)}
          className="h-9 w-9 flex items-center justify-center rounded-md border border-[#E5E2D8] bg-[#F4F2ED] text-[#602460] hover:bg-[#602460]/10 transition-colors text-lg font-bold"
          title="Nouvelle catégorie">+</button>
      </div>
      {showNewCategory && (
        <div className="flex items-center gap-1 mt-1">
          <Input placeholder="Nom de la catégorie" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
            className="flex-1 h-8 text-xs" onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory() }} />
          <Button type="button" size="sm" className="h-8 text-xs" disabled={!newCategoryName} onClick={handleCreateCategory}>Créer</Button>
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouveau produit</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

          <div className="space-y-1.5">
            <Label>Type de produit</Label>
            <div className="flex rounded-lg border border-[#E5E2D8] overflow-hidden text-sm">
              <button type="button" onClick={() => setKind('food')}
                className="flex-1 px-4 py-2 transition-colors font-medium"
                style={{ background: kind === 'food' ? '#602460' : '#F4F2ED', color: kind === 'food' ? '#fff' : '#7B6B80' }}>
                Alimentation (Menu)
              </button>
              <button type="button" onClick={() => setKind('beverage')}
                className="flex-1 px-4 py-2 transition-colors font-medium"
                style={{ background: kind === 'beverage' ? '#602460' : '#F4F2ED', color: kind === 'beverage' ? '#fff' : '#7B6B80' }}>
                Boisson
              </button>
            </div>
          </div>

          {kind === 'food' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Nom *</Label>
                <Input value={foodName} onChange={e => setFoodName(e.target.value)} placeholder="Plat du jour" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Outlet</Label>
                <Select value={outlet} onValueChange={setOutlet}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTLETS.map(o => <SelectItem key={o} value={o}>{OUTLET_LABELS[o]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <SupplierSelect value={foodExtra.supplier_id} onChange={v => setFoodExtra(f => ({ ...f, supplier_id: v }))} />
              <CategorySelect value={foodExtra.category_id} onChange={v => setFoodExtra(f => ({ ...f, category_id: v }))} cats={foodCategories} />
              <div className="space-y-1.5">
                <Label>Unité</Label>
                <Input value={foodExtra.unit} onChange={setFood('unit')} placeholder="pcs, kg, L..." />
              </div>
              <div className="space-y-1.5">
                <Label>Conditionnement</Label>
                <Input value={foodExtra.packaging_desc} onChange={setFood('packaging_desc')} placeholder="Carton 24 pcs" />
              </div>
              <div className="space-y-1.5">
                <Label>Qté par cond.</Label>
                <Input type="number" value={foodExtra.packaging_qty} onChange={setFood('packaging_qty')} placeholder="24" />
              </div>
              <div className="space-y-1.5">
                <Label>Prix HT (€)</Label>
                <Input type="number" value={foodExtra.price_excl_tax} onChange={setFood('price_excl_tax')} placeholder="0.00" step="0.01" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Nom *</Label>
                <Input value={bevForm.name} onChange={setBev('name')} placeholder="Nom du produit" />
              </div>
              <div className="space-y-1.5">
                <Label>SKU / Référence</Label>
                <Input value={bevForm.sku} onChange={setBev('sku')} placeholder="REF-001" />
              </div>
              <SupplierSelect value={bevForm.supplier_id} onChange={v => setBevForm(f => ({ ...f, supplier_id: v }))} />
              <CategorySelect value={bevForm.category_id} onChange={handleBevCategoryChange} cats={bevCategories} />
              <div className="space-y-1.5">
                <Label>Unité</Label>
                <Input value={bevForm.unit} onChange={setBev('unit')} placeholder="pcs, kg, L..." />
              </div>
              <div className="space-y-1.5">
                <Label>Conditionnement</Label>
                <Input value={bevForm.packaging_desc} onChange={setBev('packaging_desc')} placeholder="Carton 24 pcs" />
              </div>
              <div className="space-y-1.5">
                <Label>Qté par cond.</Label>
                <Input type="number" value={bevForm.packaging_qty} onChange={setBev('packaging_qty')} placeholder="24" />
              </div>
              <div className="space-y-1.5">
                <Label>Prix HT (€)</Label>
                <Input type="number" value={bevForm.price_excl_tax} onChange={setBev('price_excl_tax')} placeholder="0.00" step="0.01" />
              </div>
              <div className="space-y-1.5">
                <Label>Stock minimum</Label>
                <Input type="number" value={bevForm.min_stock} onChange={setBev('min_stock')} placeholder="10" />
              </div>
              <div className="space-y-1.5">
                <Label>Délai livraison (jours)</Label>
                <Input type="number" value={bevForm.delivery_days} onChange={setBev('delivery_days')} placeholder="3" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>URL commande</Label>
                <Input value={bevForm.purchase_url} onChange={setBev('purchase_url')} placeholder="https://..." type="url" />
              </div>

              <div className="col-span-2 space-y-2">
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
                    <button type="button" onClick={() => removeSubProduct(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Enregistrement…' : 'Créer et mapper'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
