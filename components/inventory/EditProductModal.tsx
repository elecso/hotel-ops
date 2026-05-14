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
  })

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
      })
    }
  }, [product])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

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
      }).eq('id', product.id)

      if (pErr) throw pErr
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
            <div className="space-y-1.5">
              <Label>Fournisseur</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm(f => ({ ...f, supplier_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.type === product.type).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>
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
