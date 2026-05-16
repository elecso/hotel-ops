'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface FoodProduct { id: number; name: string; unit: string; price_excl_tax: number | null }
interface MenuItemRef { id: number; name: string; outlet: string; recipe_id: number | null }
interface IngredientDraft { product_id: string; quantity: string; unit: string }

type TabCategory = 'food' | 'beverage'

interface Props {
  recipes: Recipe[]
  foodProducts: FoodProduct[]
  beverageProducts: FoodProduct[]
  allMenuItems: MenuItemRef[]
  isManager: boolean
}

interface Recipe {
  id: number
  name: string
  category: 'food' | 'beverage' | null
  outlet: string
  portion_size_g: number
  selling_price: number
  is_active: boolean
  ingredients: { id: number; product_id: number; quantity: number; unit: string; product: { id: number; name: string; unit: string } | null }[]
  menu_items: { id: number; name: string; outlet: string }[]
}

const FOOD_OUTLETS = ['Breakfast', 'Déjeuner', 'Dîner', 'Room Service', 'Banquet', 'À l\'épicerie']
const BEVERAGE_OUTLETS = ['Bar', 'Banquet', 'Room Service', 'À l\'épicerie']

export function RecipesClient({ recipes: initialRecipes, foodProducts, beverageProducts, allMenuItems, isManager }: Props) {
  const [recipes, setRecipes] = useState(initialRecipes)
  const [activeTab, setActiveTab] = useState<TabCategory>('food')
  const [showModal, setShowModal] = useState(false)
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const [form, setForm] = useState({ name: '', category: 'food' as TabCategory, outlet: '', portion_size_g: '', selling_price: '' })
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('')
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([])

  const filtered = recipes.filter(r => (r.category ?? 'food') === activeTab)

  const productOptions = form.category === 'beverage' ? beverageProducts : foodProducts
  const outletOptions = form.category === 'beverage' ? BEVERAGE_OUTLETS : FOOD_OUTLETS

  const openCreate = () => {
    setEditRecipe(null)
    setForm({ name: '', category: activeTab, outlet: '', portion_size_g: '', selling_price: '' })
    setSelectedMenuItemId('')
    setIngredients([{ product_id: '', quantity: '', unit: '' }])
    setShowModal(true)
  }

  const openEdit = (r: Recipe) => {
    setEditRecipe(r)
    setForm({
      name: r.name,
      category: r.category ?? 'food',
      outlet: r.outlet ?? '',
      portion_size_g: String(r.portion_size_g ?? ''),
      selling_price: String(r.selling_price ?? ''),
    })
    const linked = r.menu_items?.[0]
    setSelectedMenuItemId(linked ? String(linked.id) : '')
    setIngredients(r.ingredients.map(ing => ({
      product_id: String(ing.product_id),
      quantity: String(ing.quantity),
      unit: ing.unit ?? '',
    })))
    setShowModal(true)
  }

  const addIngredient = () => setIngredients(prev => [...prev, { product_id: '', quantity: '', unit: '' }])
  const removeIngredient = (i: number) => setIngredients(prev => prev.filter((_, idx) => idx !== i))

  const updateIngredient = (i: number, key: keyof IngredientDraft, val: string) =>
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [key]: val } : ing))

  const handleSave = async () => {
    setSaving(true)
    const recipeData = {
      name: form.name,
      category: form.category,
      outlet: form.outlet || null,
      portion_size_g: form.portion_size_g ? parseFloat(form.portion_size_g) : null,
      selling_price: form.selling_price ? parseFloat(form.selling_price) : null,
      is_active: true,
    }

    let recipeId = editRecipe?.id
    if (editRecipe) {
      await supabase.from('recipes').update(recipeData).eq('id', editRecipe.id)
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', editRecipe.id)
    } else {
      const { data } = await supabase.from('recipes').insert(recipeData).select().single()
      recipeId = data?.id
    }

    if (recipeId) {
      const validIngs = ingredients.filter(i => i.product_id && i.quantity)
      if (validIngs.length > 0) {
        await supabase.from('recipe_ingredients').insert(
          validIngs.map(i => ({
            recipe_id: recipeId,
            product_id: parseInt(i.product_id),
            quantity: parseFloat(i.quantity),
            unit: i.unit || null,
          }))
        )
      }

      // Unlink previously linked menu_item for this recipe
      await supabase.from('menu_items').update({ recipe_id: null }).eq('recipe_id', recipeId)
      // Link the selected menu_item
      if (selectedMenuItemId) {
        await supabase.from('menu_items').update({ recipe_id: recipeId }).eq('id', parseInt(selectedMenuItemId))
      }
    }

    // Refresh
    const { data: updated } = await supabase
      .from('recipes')
      .select('*, ingredients:recipe_ingredients(*, product:products(id, name, unit)), menu_items(*)')
      .eq('is_active', true)
      .order('name')
    setRecipes(updated ?? [])
    setShowModal(false)
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-1 border-b border-[#C5C0B1]">
        {([['food', 'Alimentation'], ['beverage', 'Boissons / Cocktails']] as [TabCategory, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === id
                ? 'border-b-2 border-[#602460] text-[#602460]'
                : 'text-[#C5C0B1] hover:text-[#3D1640]'
            }`}
          >
            {label}
            <span className="ml-2 text-xs font-mono">
              ({recipes.filter(r => (r.category ?? 'food') === id).length})
            </span>
          </button>
        ))}
        <div className="flex-1" />
        {isManager && (
          <Button onClick={openCreate} className="mb-1 self-center">
            <Plus size={16} /> Créer une recette
          </Button>
        )}
      </div>

      <div className="bg-white rounded-[10px] border border-[#C5C0B1] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recette</TableHead>
              <TableHead>Outlet</TableHead>
              <TableHead>Portion (g)</TableHead>
              <TableHead>Prix vente</TableHead>
              <TableHead>Ingrédients</TableHead>
              <TableHead>Menu items</TableHead>
              {isManager && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8" style={{ color: '#C5C0B1' }}>
                  Aucune recette dans cette catégorie.
                </TableCell>
              </TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.outlet ?? '—'}</TableCell>
                <TableCell className="font-mono">{r.portion_size_g ?? '—'}</TableCell>
                <TableCell className="font-mono">{r.selling_price ? formatCurrency(r.selling_price) : '—'}</TableCell>
                <TableCell>
                  <span className="text-sm font-mono" style={{ color: '#602460' }}>{r.ingredients?.length ?? 0}</span>
                </TableCell>
                <TableCell>
                  {r.menu_items?.length > 0
                    ? r.menu_items.map(mi => <Badge key={mi.id} className="mr-1 mb-1">{mi.name}</Badge>)
                    : <span style={{ color: '#C5C0B1' }}>—</span>}
                </TableCell>
                {isManager && (
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Edit2 size={14} />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showModal} onOpenChange={o => !o && setShowModal(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRecipe ? 'Modifier la recette' : 'Nouvelle recette'}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Salade niçoise" />
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as TabCategory, outlet: '' }))}
                  className="flex h-9 w-full rounded-[6px] border border-[#C5C0B1] bg-white px-3 py-1 text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#7E3A7E]"
                >
                  <option value="food">Alimentation</option>
                  <option value="beverage">Boisson / Cocktail</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Outlet</Label>
                <select
                  value={form.outlet}
                  onChange={e => setForm(f => ({ ...f, outlet: e.target.value }))}
                  className="flex h-9 w-full rounded-[6px] border border-[#C5C0B1] bg-white px-3 py-1 text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#7E3A7E]"
                >
                  <option value="">Sélectionner…</option>
                  {outletOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Portion (g)</Label>
                <Input type="number" value={form.portion_size_g} onChange={e => setForm(f => ({ ...f, portion_size_g: e.target.value }))} placeholder="200" />
              </div>
              <div className="space-y-1.5">
                <Label>Prix de vente (€)</Label>
                <Input type="number" step="0.01" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} placeholder="12.50" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Article du menu lié</Label>
              <select
                value={selectedMenuItemId}
                onChange={e => setSelectedMenuItemId(e.target.value)}
                className="flex h-9 w-full rounded-[6px] border border-[#C5C0B1] bg-white px-3 py-1 text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#7E3A7E]"
              >
                <option value="">Aucun lien</option>
                {allMenuItems.map(mi => (
                  <option key={mi.id} value={mi.id}>
                    {mi.name}{mi.outlet ? ` — ${mi.outlet}` : ''}{mi.recipe_id && mi.recipe_id !== editRecipe?.id ? ' (déjà lié)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#B0A5B4]">Quand des ventes F&B sont importées pour cet article, les ingrédients seront décrémentés automatiquement.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingrédients</Label>
                <Button type="button" variant="secondary" size="sm" onClick={addIngredient}>
                  <Plus size={14} /> Ajouter
                </Button>
              </div>
              <div className="space-y-2">
                {ingredients.map((ing, i) => {
                  const sel = productOptions.find(p => String(p.id) === ing.product_id)
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <select
                          value={ing.product_id}
                          onChange={e => {
                            const prod = productOptions.find(p => String(p.id) === e.target.value)
                            updateIngredient(i, 'product_id', e.target.value)
                            if (prod) updateIngredient(i, 'unit', prod.unit)
                          }}
                          className="flex-1 h-9 rounded-[6px] border border-[#C5C0B1] bg-white px-3 text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#7E3A7E]"
                        >
                          <option value="">Produit…</option>
                          {productOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <Input
                          placeholder="Qté"
                          value={ing.quantity}
                          onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                          type="number"
                          className="w-24"
                        />
                        <Input
                          placeholder="Unité"
                          value={ing.unit}
                          onChange={e => updateIngredient(i, 'unit', e.target.value)}
                          className="w-20"
                        />
                        <button onClick={() => removeIngredient(i)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {sel && (
                        <div className="flex items-center gap-3 pl-1 text-[11px] text-[#B0A5B4]">
                          <span>Unité: <span className="font-semibold text-[#3D1640]">{sel.unit}</span></span>
                          {sel.price_excl_tax != null && (
                            <span>Prix HT: <span className="font-semibold text-sky-600">{formatCurrency(sel.price_excl_tax)}</span></span>
                          )}
                          {ing.quantity && sel.price_excl_tax != null && (
                            <span>Coût ligne: <span className="font-semibold text-[#602460]">{formatCurrency(parseFloat(ing.quantity) * sel.price_excl_tax)}</span></span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
