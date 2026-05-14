'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Edit2, Check, X, ExternalLink, Pencil } from 'lucide-react'
import type { Product, StockMonth, Supplier, ProductCategory, RoomType } from '@/lib/types'
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

export function InventoryTable({ rows, month, isAdmin, onRefresh, suppliers, categories, roomTypes }: Props) {
  const [localRows, setLocalRows] = useState<StockRow[]>(rows)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Sync when parent re-fetches after month switch / auto-populate
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
            return (
              <TableRow
                key={product.id}
                className={isLow ? 'border-l-2 border-l-amber-500 bg-amber-50' : ''}
              >
                <TableCell>
                  <div>
                    <p className="font-medium text-sm text-[#3D1640]">{product.name}</p>
                    {product.sku && <p className="text-[11px] font-mono text-[#B0A5B4]">{product.sku}</p>}
                    {isLow && <Badge variant="pending" className="mt-1">Stock bas</Badge>}
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
