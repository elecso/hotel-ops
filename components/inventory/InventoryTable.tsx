'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit2, Check, X, ExternalLink, Pencil, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { Product, StockMonth, Supplier, ProductCategory, RoomType, ProductType } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { EditProductModal } from './EditProductModal'

interface StockRow {
  product: Product
  stock: StockMonth | null
  theoretical: number
}

interface Props {
  rows: StockRow[]
  month: string
  isAdmin: boolean
  onRefresh: () => void
  suppliers: Supplier[]
  categories: ProductCategory[]
  roomTypes: RoomType[]
  type?: ProductType
}

function StockCell({
  value, productId, month, field, isAdmin, onSaved,
}: {
  value: number
  productId: number
  month: string
  field: 'opening_stock' | 'used'
  isAdmin: boolean
  onSaved: (val: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const supabase = createClient()

  const save = async () => {
    const num = parseFloat(draft)
    if (isNaN(num)) { setEditing(false); return }
    await supabase.from('stock_months').upsert(
      { product_id: productId, month, [field]: num },
      { onConflict: 'product_id,month' }
    )
    onSaved(num)
    setEditing(false)
  }

  if (!isAdmin) return <span className="font-mono text-sm text-[#3D1640]">{value}</span>

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          className="h-7 w-20 text-xs"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus
          type="number"
          min="0"
        />
        <button onClick={save} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
        <button onClick={() => setEditing(false)} className="text-red-500 hover:text-red-600"><X size={14} /></button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      className="font-mono text-sm hover:underline flex items-center gap-1 text-left text-[#602460] hover:text-[#7E3A7E]"
    >
      {value}
      <Edit2 size={10} className="opacity-50" />
    </button>
  )
}

interface SubProductDraft {
  name: string
  volume_cl: string
  decrement_factor: string
}

function SubProductsRow({ product, isAdmin, onRefresh }: { product: Product; isAdmin: boolean; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<SubProductDraft>({ name: '', volume_cl: '', decrement_factor: '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const subProducts = product.sub_products ?? []

  const handleAdd = async () => {
    if (!draft.name || !draft.decrement_factor) return
    setSaving(true)
    await supabase.from('beverage_sub_products').insert({
      parent_product_id: product.id,
      name: draft.name,
      volume_cl: draft.volume_cl ? parseFloat(draft.volume_cl) : null,
      decrement_factor: parseFloat(draft.decrement_factor),
    })
    setSaving(false)
    setAdding(false)
    setDraft({ name: '', volume_cl: '', decrement_factor: '' })
    onRefresh()
  }

  const handleDelete = async (id: number) => {
    await supabase.from('beverage_sub_products').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div className="px-4 py-2 bg-[#F9F7F4] border-t border-[#E5E2D8]">
      <p className="text-[11px] font-semibold text-[#7B6B80] uppercase tracking-wide mb-2">Sous-produits (verres / portions)</p>
      {subProducts.length > 0 && (
        <div className="space-y-1 mb-2">
          {subProducts.map(sp => (
            <div key={sp.id} className="flex items-center gap-3 text-xs text-[#3D1640]">
              <span className="font-medium w-40 truncate">{sp.name}</span>
              {sp.volume_cl && <span className="text-[#B0A5B4]">{sp.volume_cl} cl</span>}
              <span className="text-[#7B6B80]">Facteur: <span className="font-mono text-[#602460]">{sp.decrement_factor}</span></span>
              <span className="text-[10px] text-[#B0A5B4]">(1 verre = {sp.decrement_factor} bouteille)</span>
              {isAdmin && (
                <button onClick={() => handleDelete(sp.id)} className="text-red-400 hover:text-red-600 ml-auto">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {isAdmin && !adding && (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-[11px] text-[#602460] hover:text-[#7E3A7E]">
          <Plus size={11} /> Ajouter un sous-produit
        </button>
      )}
      {adding && (
        <div className="flex items-center gap-2 mt-1">
          <Input placeholder="Nom (ex: Verre 25cl)" value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            className="h-7 text-xs flex-1" />
          <Input placeholder="Vol. (cl)" value={draft.volume_cl}
            onChange={e => setDraft(d => ({ ...d, volume_cl: e.target.value }))}
            className="h-7 text-xs w-20" type="number" />
          <Input placeholder="Facteur" value={draft.decrement_factor}
            onChange={e => setDraft(d => ({ ...d, decrement_factor: e.target.value }))}
            className="h-7 text-xs w-20" type="number" step="0.01" />
          <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={saving || !draft.name || !draft.decrement_factor}>
            {saving ? '…' : <Check size={12} />}
          </Button>
          <button onClick={() => setAdding(false)} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export function InventoryTable({ rows, month, isAdmin, onRefresh, suppliers, categories, roomTypes, type }: Props) {
  const [localRows, setLocalRows] = useState<StockRow[]>(rows)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [expandedSubs, setExpandedSubs] = useState<number[]>([])

  useEffect(() => { setLocalRows(rows) }, [rows])

  const updateField = (productId: number, field: 'opening_stock' | 'used', value: number) => {
    setLocalRows(prev => prev.map(r => {
      if (r.product.id !== productId) return r
      const stock = r.stock ?? { product_id: productId, month, opening_stock: 0, bought: 0, used: 0, id: 0 }
      const updated = { ...stock, [field]: value }
      const theoretical = updated.opening_stock + updated.bought - updated.used
      return { ...r, stock: updated as StockMonth, theoretical }
    }))
  }

  const toggleSub = (id: number) =>
    setExpandedSubs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const isBeverage = type === 'beverage'

  if (localRows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[#B0A5B4]">
        Aucun produit dans cette catégorie.
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {isBeverage && <TableHead className="w-8"></TableHead>}
            <TableHead>Produit</TableHead>
            <TableHead>Fournisseur</TableHead>
            <TableHead>Unité</TableHead>
            <TableHead>Conditionnement</TableHead>
            <TableHead>Prix HT</TableHead>
            <TableHead>Stock initial</TableHead>
            <TableHead>Acheté</TableHead>
            <TableHead>Utilisé</TableHead>
            <TableHead>Stock théorique</TableHead>
            <TableHead>Stock min.</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {localRows.map(({ product, stock, theoretical }) => {
            const isLow = theoretical < (product.min_stock ?? 0)
            const isSubOpen = expandedSubs.includes(product.id)
            const hasSubProducts = isBeverage && ((product.sub_products?.length ?? 0) > 0 || isAdmin)
            return (
              <>
                <TableRow
                  key={product.id}
                  className={isLow ? 'border-l-2 border-l-amber-500 bg-amber-50' : ''}
                >
                  {isBeverage && (
                    <TableCell className="w-8">
                      {hasSubProducts && (
                        <button onClick={() => toggleSub(product.id)} className="text-[#B0A5B4] hover:text-[#602460]">
                          {isSubOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm text-[#3D1640]">{product.name}</p>
                      {product.sku && <p className="text-[11px] font-mono text-[#B0A5B4]">{product.sku}</p>}
                      {isLow && <Badge variant="pending" className="mt-1">Stock bas</Badge>}
                      {isBeverage && (product.sub_products?.length ?? 0) > 0 && (
                        <p className="text-[10px] text-[#B0A5B4] mt-0.5">{product.sub_products!.length} sous-produit(s)</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-[#7B6B80]">{product.supplier?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm font-mono text-[#7B6B80]">{product.unit ?? '—'}</TableCell>
                  <TableCell className="text-sm text-[#7B6B80]">
                    {product.packaging_desc ?? ''}
                    {product.packaging_qty ? ` (${product.packaging_qty})` : ''}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-sky-700">
                    {product.price_excl_tax ? formatCurrency(product.price_excl_tax) : '—'}
                  </TableCell>
                  <TableCell>
                    <StockCell
                      value={stock?.opening_stock ?? 0}
                      productId={product.id}
                      month={month}
                      field="opening_stock"
                      isAdmin={isAdmin}
                      onSaved={v => updateField(product.id, 'opening_stock', v)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm text-green-700">{stock?.bought ?? 0}</TableCell>
                  <TableCell>
                    <StockCell
                      value={stock?.used ?? 0}
                      productId={product.id}
                      month={month}
                      field="used"
                      isAdmin={isAdmin}
                      onSaved={v => updateField(product.id, 'used', v)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className={`font-mono text-sm font-bold ${isLow ? 'text-amber-600' : 'text-[#602460]'}`}>
                      {theoretical.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-[#7B6B80]">{product.min_stock ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="text-[#B0A5B4] hover:text-[#602460] p-1 rounded hover:bg-[#602460]/10 transition-colors"
                          title="Modifier le produit"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {product.purchase_url && (
                        <a
                          href={product.purchase_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#B0A5B4] hover:text-sky-600 p-1 transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                {isBeverage && isSubOpen && (
                  <tr key={`sub-${product.id}`}>
                    <td colSpan={12} className="p-0">
                      <SubProductsRow product={product} isAdmin={isAdmin} onRefresh={onRefresh} />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </TableBody>
      </Table>

      {editingProduct && (
        <EditProductModal
          open={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => { setEditingProduct(null); onRefresh() }}
          product={editingProduct}
          suppliers={suppliers}
          categories={categories}
          roomTypes={roomTypes}
        />
      )}
    </>
  )
}
