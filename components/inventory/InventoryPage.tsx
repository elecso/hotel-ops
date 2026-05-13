'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InventoryTable } from './InventoryTable'
import { AddProductModal } from './AddProductModal'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import type { Product, StockMonth, Supplier, ProductCategory, RoomType, ProductType } from '@/lib/types'
import { currentMonth, monthLabel } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any

interface Props {
  rows?: AnyRow[]
  month?: string
  type: ProductType
  suppliers: Supplier[]
  categories: ProductCategory[]
  roomTypes: RoomType[]
  isAdmin: boolean
}

function generateMonthOptions() {
  const opts = []
  const now = new Date()
  for (let i = -6; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    opts.push({ value: iso, label: monthLabel(iso) })
  }
  return opts
}

export function InventoryPage({ rows: rowsProp = [], month: monthProp, type, suppliers, categories, roomTypes, isAdmin }: Props) {
  const [month, setMonth] = useState(monthProp ?? currentMonth())
  const [rows, setRows] = useState<AnyRow[]>(rowsProp)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const loadRows = useCallback(async (m: string) => {
    setLoading(true)
    const { data: products } = await supabase
      .from('products')
      .select('*, supplier:suppliers(*), category:product_categories(*), sub_products:beverage_sub_products(*)')
      .eq('type', type)
      .eq('is_active', true)
      .order('name')

    const { data: stockData } = await supabase
      .from('stock_months')
      .select('*')
      .eq('month', m)
      .in('product_id', (products ?? []).map((p: Product) => p.id))

    const newRows = (products ?? []).map((p: Product) => {
      const stock = stockData?.find((s: StockMonth) => s.product_id === p.id) ?? null
      const theoretical = (stock?.opening_stock ?? 0) + (stock?.bought ?? 0) - (stock?.used ?? 0)
      return { product: p, stock, theoretical }
    })
    setRows(newRows)
    setLoading(false)
  }, [type, supabase])

  const handleMonthChange = (m: string) => {
    setMonth(m)
    loadRows(m)
  }

  const monthOptions = generateMonthOptions()

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={month} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loading && <span className="text-sm" style={{ color: '#C5C0B1' }}>Chargement…</span>}
        </div>
        {isAdmin && (
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} /> Ajouter un produit
          </Button>
        )}
      </div>

      <div className="bg-white rounded-[10px] border border-[#C5C0B1] overflow-hidden">
        <InventoryTable rows={rows} month={month} isAdmin={isAdmin} onRefresh={() => loadRows(month)} />
      </div>

      <AddProductModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => loadRows(month)}
        type={type}
        suppliers={suppliers}
        categories={categories}
        roomTypes={roomTypes}
      />
    </div>
  )
}
