'use client'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Edit2, Check, X, ExternalLink, ChevronRight } from 'lucide-react'
import type { Product, StockMonth, Supplier, ProductCategory, BeverageSubProduct } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

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
}

function StockCell({
  value,
  productId,
  month,
  field,
  isAdmin,
  onSaved,
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

  if (!isAdmin) return <span className="font-mono text-sm">{value}</span>

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
        <button onClick={() => setEditing(false)} className="text-red-500 hover:text-red-700"><X size={14} /></button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      className="font-mono text-sm hover:underline flex items-center gap-1 text-left"
      style={{ color: '#602460' }}
    >
      {value}
      <Edit2 size={10} className="opacity-50" />
    </button>
  )
}

export function InventoryTable({ rows, month, isAdmin, onRefresh }: Props) {
  const [localRows, setLocalRows] = useState<StockRow[]>(rows)

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
      <div className="py-12 text-center text-sm" style={{ color: '#C5C0B1' }}>
        Aucun produit dans cette catégorie.
      </div>
    )
  }

  return (
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
              className={isLow ? 'bg-amber-50 border-l-4 border-l-amber-500' : ''}
            >
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{product.name}</p>
                  {product.sku && <p className="text-[11px] font-mono" style={{ color: '#C5C0B1' }}>{product.sku}</p>}
                  {isLow && (
                    <Badge variant="pending" className="mt-1">Stock bas</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">{product.supplier?.name ?? '—'}</TableCell>
              <TableCell className="text-sm font-mono">{product.unit ?? '—'}</TableCell>
              <TableCell className="text-sm">
                {product.packaging_desc ?? ''}
                {product.packaging_qty ? ` (${product.packaging_qty})` : ''}
              </TableCell>
              <TableCell className="text-sm font-mono">
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
              <TableCell className="font-mono text-sm">{stock?.bought ?? 0}</TableCell>
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
                <span
                  className={`font-mono text-sm font-bold ${isLow ? 'text-amber-600' : 'text-[#602460]'}`}
                >
                  {theoretical.toFixed(2)}
                </span>
              </TableCell>
              <TableCell className="font-mono text-sm">{product.min_stock ?? '—'}</TableCell>
              <TableCell>
                {product.purchase_url && (
                  <a
                    href={product.purchase_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#602460] hover:text-[#3D1640]"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
