'use client'
import { useState } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Pencil } from 'lucide-react'
import type { Product, Supplier, ProductCategory } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { EditProductModal } from './EditProductModal'

interface FoodRow {
  product: Product
  stock: null
  theoretical: number
}

interface Props {
  rows: FoodRow[]
  isAdmin: boolean
  onRefresh: () => void
  suppliers: Supplier[]
  categories: ProductCategory[]
}

export function FoodProductList({ rows, isAdmin, onRefresh, suppliers, categories }: Props) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[#B0A5B4]">
        Aucun produit alimentaire. Utilisez le bouton &quot;Ajouter un produit&quot; ou &quot;Import CSV&quot;.
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produit</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead>Fournisseur</TableHead>
            <TableHead>Unité</TableHead>
            <TableHead>Conditionnement</TableHead>
            <TableHead>Prix HT</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ product }) => (
            <TableRow key={product.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-sm text-[#3D1640]">{product.name}</p>
                  {product.sku && <p className="text-[11px] font-mono text-[#B0A5B4]">{product.sku}</p>}
                </div>
              </TableCell>
              <TableCell className="text-sm text-[#7B6B80]">
                {(product.category as { name?: string } | null)?.name ?? '—'}
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
                {isAdmin && (
                  <button
                    onClick={() => setEditingProduct(product)}
                    className="text-[#B0A5B4] hover:text-[#602460] p-1 rounded hover:bg-[#602460]/10 transition-colors"
                    title="Modifier le produit"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </TableCell>
            </TableRow>
          ))}
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
          roomTypes={[]}
        />
      )}
    </>
  )
}
