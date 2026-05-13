import { loadInventoryData } from '@/lib/inventory-loader'
import { InventoryPage } from '@/components/inventory/InventoryPage'

export default async function BeveragesInventoryPage() {
  const { rows, month, suppliers, categories, roomTypes, isAdmin } = await loadInventoryData('beverage')
  return <InventoryPage rows={rows} month={month} suppliers={suppliers} categories={categories} roomTypes={roomTypes} isAdmin={isAdmin} type="beverage" />
}
