'use client'
import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InventoryTable } from './InventoryTable'
import { FoodProductList } from './FoodProductList'
import { AddProductModal } from './AddProductModal'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Plus, Upload } from 'lucide-react'
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
  salesOnly?: boolean
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

export function InventoryPage({ rows: rowsProp = [], month: monthProp, type, suppliers, categories, roomTypes, isAdmin, salesOnly = false }: Props) {
  const [month, setMonth] = useState(monthProp ?? currentMonth())
  const [rows, setRows] = useState<AnyRow[]>(rowsProp)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [csvError, setCsvError] = useState('')
  const [csvSuccess, setCsvSuccess] = useState('')
  const csvInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const loadRows = useCallback(async (m: string) => {
    setLoading(true)
    const { data: products } = await supabase
      .from('products')
      .select('*, supplier:suppliers(*), category:product_categories(*), sub_products:beverage_sub_products(*)')
      .eq('type', type)
      .eq('is_active', true)
      .order('name')

    const productIds = (products ?? []).map((p: Product) => p.id)

    if (salesOnly) {
      setRows((products ?? []).map((p: Product) => ({ product: p, stock: null, theoretical: 0 })))
      setLoading(false)
      return
    }

    const { data: stockData } = await supabase
      .from('stock_months')
      .select('*')
      .eq('month', m)
      .in('product_id', productIds)

    const missingIds = productIds.filter((id: number) => {
      const existing = stockData?.find((s: StockMonth) => s.product_id === id)
      return !existing || (
        (existing.opening_stock ?? 0) === 0 &&
        (existing.bought ?? 0) === 0 &&
        (existing.used ?? 0) === 0
      )
    })

    if (missingIds.length > 0) {
      const d = new Date(m)
      const prevD = new Date(d.getFullYear(), d.getMonth() - 1, 1)
      const prevMonth = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-01`

      const { data: prevStock } = await supabase
        .from('stock_months')
        .select('*')
        .eq('month', prevMonth)
        .in('product_id', missingIds)

      if (prevStock && prevStock.length > 0) {
        const inserts = prevStock
          .filter((ps: StockMonth) => {
            const theoretical = (ps.opening_stock ?? 0) + (ps.bought ?? 0) - (ps.used ?? 0)
            return theoretical > 0
          })
          .map((ps: StockMonth) => ({
            product_id: ps.product_id,
            month: m,
            opening_stock: Math.max(0, (ps.opening_stock ?? 0) + (ps.bought ?? 0) - (ps.used ?? 0)),
            bought: 0,
            used: 0,
          }))

        if (inserts.length > 0) {
          await supabase.from('stock_months').upsert(inserts, { onConflict: 'product_id,month' })

          const { data: refreshed } = await supabase
            .from('stock_months')
            .select('*')
            .eq('month', m)
            .in('product_id', productIds)

          setRows((products ?? []).map((p: Product) => {
            const stock = refreshed?.find((s: StockMonth) => s.product_id === p.id) ?? null
            return { product: p, stock, theoretical: (stock?.opening_stock ?? 0) + (stock?.bought ?? 0) - (stock?.used ?? 0) }
          }))
          setLoading(false)
          return
        }
      }
    }

    setRows((products ?? []).map((p: Product) => {
      const stock = stockData?.find((s: StockMonth) => s.product_id === p.id) ?? null
      return { product: p, stock, theoretical: (stock?.opening_stock ?? 0) + (stock?.bought ?? 0) - (stock?.used ?? 0) }
    }))
    setLoading(false)
  }, [type, supabase, salesOnly])

  const handleMonthChange = (m: string) => {
    setMonth(m)
    loadRows(m)
  }

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError('')
    setCsvSuccess('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    try {
      const res = await fetch('/api/products/import-csv', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur import')
      setCsvSuccess(`${json.created} produit(s) créé(s), ${json.updated} mis à jour.`)
      await loadRows(month)
    } catch (err: unknown) {
      setCsvError((err as Error).message)
    }

    if (csvInputRef.current) csvInputRef.current.value = ''
  }

  const monthOptions = generateMonthOptions()
  const relevantCategories = categories.filter(c => c.type === type)
  const filteredRows = filterCategory !== 'all'
    ? rows.filter(r => String(r.product?.category_id) === filterCategory)
    : rows

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {!salesOnly && (
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
          )}
          {relevantCategories.length > 0 && (
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Toutes catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {relevantCategories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {loading && <span className="text-sm text-[#B0A5B4]">Chargement…</span>}
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                id="csv-import"
                onChange={handleCsvImport}
              />
              <a
                href={`/samples/products-${type === 'cleaning_fb' || type === 'cleaning_general' ? 'cleaning' : type === 'room' ? 'room' : type === 'beverage' ? 'beverage' : type === 'food' ? 'food' : type === 'ingredient' ? 'ingredient' : 'room'}-sample.csv`}
                download
                className="text-[11px] text-[#B0A5B4] hover:text-[#602460] underline underline-offset-2 transition-colors"
              >
                Exemple CSV
              </a>
              <Button variant="secondary" onClick={() => csvInputRef.current?.click()}>
                <Upload size={14} /> Import CSV
              </Button>
              <Button onClick={() => setShowModal(true)}>
                <Plus size={16} /> Ajouter un produit
              </Button>
            </>
          )}
        </div>
      </div>

      {csvError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{csvError}</div>
      )}
      {csvSuccess && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{csvSuccess}</div>
      )}

      {salesOnly ? (
        <div className="bg-white rounded-xl border border-[#E5E2D8] overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
            Alimentation — suivi des ventes uniquement via F&B Upload. Pas de gestion de stock direct.
          </div>
          <FoodProductList rows={filteredRows} isAdmin={isAdmin} onRefresh={() => loadRows(month)} suppliers={suppliers} categories={categories} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E2D8] overflow-hidden">
          <InventoryTable rows={filteredRows} month={month} isAdmin={isAdmin} onRefresh={() => loadRows(month)} suppliers={suppliers} categories={categories} roomTypes={roomTypes} type={type} />
        </div>
      )}

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
