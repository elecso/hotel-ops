import { loadInventoryData } from '@/lib/inventory-loader'
import { InventoryPage } from '@/components/inventory/InventoryPage'

export default async function FoodInventoryPage() {
  const { rows, month, suppliers, categories, roomTypes, isAdmin } = await loadInventoryData('food')
  return <InventoryPage rows={rows} month={month} suppliers={suppliers} categories={categories} roomTypes={roomTypes} isAdmin={isAdmin} type="food" />
}
