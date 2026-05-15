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

const OUTLETS = ['lunch', 'dinner', 'bar', 'room_service', 'banquet'] as const
const OUTLET_LABELS: Record<string, string> = {
  lunch: 'Déjeuner', dinner: 'Dîner', bar: 'Bar', room_service: 'Room Service', banquet: 'Banquet',
}

const VIN_SUB_PRODUCTS: SubProductDraft[] = [
  { name: 'Pichet 50CL', volume_cl: '50', decrement_factor: '0.66' },
  { name: 'Pichet 25CL', volume_cl: '25', decrement_factor: '0.33' },
  { name: 'Verre 15CL',  volume_cl: '15', decrement_factor: '0.2'  },
  { name: 'Verre 8CL',   volume_cl: '8',  decrement_factor: '0.1'  },
]

const EMPTY_FORM = {
  name: '', sku: '', supplier_id: '', category_id: '',
  unit: '', packaging_desc: '', packaging_qty: '',
  price_excl_tax: '', min_stock: '', delivery_days: '', purchase_url: '',
}

export function AddFbProductModal({ open, lineIdx, defaultName, onClose, onCreatedMenuItem, onCreatedBeverage }: Props) {
  const supabase = createClient()
  const [kind, setKind] = useState<'food' | 'beverage'>('food')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [foodName, setFoodName] = useState('')
  const [outlet, setOutlet] = useState('lunch')

  const [form, setForm] = useState(EMPTY_FORM)
  const [subProducts, setSubProducts] = useState<SubProductDraft[]>([])
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => {
    if (!open) return
    setFoodName(defaultName)
    setForm({ ...EMPTY_FORM, name: defaultName })
    setKind('food')
    setOutlet('lunch')
    setSubProducts([])
    setError('')
    setShowNewSupplier(false)
    setShowNewCategory(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Promise.all([
      supabase.from('suppliers').select('id, name').order('name'),
      supabase.from('product_categories').select('id, name, type').eq('type', 'beverage').order('name'),
    ]).then(([{ data: sup }, { data: cat }]) => {
      setSuppliers((sup as Supplier[]) ?? [])
      setCategories((cat as Category[]) ?? [])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultName])

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleCategoryChange = (v: string) => {
    setForm(f => ({ ...f, category_id: v }))
    const cat = categories.find(c => String(c.id) === v)
    if (cat?.name?.toLowerCase().includes('vin')) setSubProducts(VIN_SUB_PRODUCTS)
  }

  const handleCreateSupplier = async () => {
    if (!newSupplierName) return
    const { data } = await supabase.from('suppliers').insert({ name: newSupplierName }).select().single()
    if (data) {
      setSuppliers(prev => [...prev, data as Supplier])
      setForm(f => ({ ...f, supplier_id: String(data.id) }))
      setNewSupplierName('')
      setShowNewSupplier(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName) return
    const { data } = await supabase.from('product_categories').insert({ name: newCategoryName, type: 'beverage' }).select().single()
    if (data) {
      setCategories(prev => [...prev, data as Category])
      setForm(f => ({ ...f, category_id: String(data.id) }))
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
        const { data } = await supabase
          .from('menu_items')
          .insert({ name: foodName.trim(), outlet, is_active: true })
          .select('id, name, outlet, recipe_id')
          .single()
        if (data) onCreatedMenuItem(lineIdx, data as FbMenuItem)
      } else {
        if (!form.name.trim()) throw new Error('Le nom est obligatoire')
        const { data: product, error: pErr } = await supabase.from('products').insert({
          name: form.name,
          sku: form.sku || null,
          supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
          category_id: form.category_id ? parseInt(form.category_id) : null,
          type: 'beverage',
          unit: form.unit || null,
          packaging_desc: form.packaging_desc || null,
          packaging_qty: form.packaging_qty ? parseFloat(form.packaging_qty) : null,
          price_excl_tax: form.price_excl_tax ? parseFloat(form.price_excl_tax) : null,
          min_stock: form.min_stock ? parseFloat(form.min_stock) : null,
          delivery_days: form.delivery_days ? parseInt(form.delivery_days) : null,
          purchase_url: form.purchase_url || null,
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

  const canSave = kind === 'food' ? !!foodName.trim() : !!form.name.trim()

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
              <button
                type="button"
                onClick={() => setKind('food')}
                className="flex-1 px-4 py-2 transition-colors font-medium"
                style={{ background: kind === 'food' ? '#602460' : '#F4F2ED', color: kind === 'food' ? '#fff' : '#7B6B80' }}
              >
                Alimentation (Menu)
              </button>
              <button
                type="button"
                onClick={() => setKind('beverage')}
                className="flex-1 px-4 py-2 transition-colors font-medium"
                style={{ background: kind === 'beverage' ? '#602460' : '#F4F2ED', color: kind === 'beverage' ? '#fff' : '#7B6B80' }}
              >
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
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
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
                        {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
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
                    <Input placeholder="Nom du fournisseur" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className="flex-1 h-8 text-xs" onKeyDown={e => { if (e.key === 'Enter') handleCreateSupplier() }} />
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
                        {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
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
                    <Input placeholder="Nom de la catégorie" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-1 h-8 text-xs" onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory() }} />
                    <Button type="button" size="sm" className="h-8 text-xs" disabled={!newCategoryName} onClick={handleCreateCategory}>Créer</Button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Unité</Label>
                <Input value={form.unit} onChange={set('unit')} placeholder="pcs, kg, L..." />
              </div>
              <div className="space-y-1.5">
                <Label>Conditionnement</Label>
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
