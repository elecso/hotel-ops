import { createClient } from '@/lib/supabase/server'
import { UploadFbClient } from './UploadFbClient'
import { isoDate } from '@/lib/utils'

export default async function UploadFbPage() {
  const supabase = await createClient()

  const [
    { data: menuItems },
    { data: beverages },
    { data: mappings },
  ] = await Promise.all([
    supabase
      .from('menu_items')
      .select('id, name, outlet, recipe_id')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, unit, sub_products:beverage_sub_products(*)')
      .eq('type', 'beverage')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('product_ai_mappings')
      .select('*')
      .eq('confirmed', true),
  ])

  const yesterday = isoDate(new Date(Date.now() - 86400000))

  return (
    <UploadFbClient
      defaultDate={yesterday}
      menuItems={menuItems ?? []}
      beverages={beverages ?? []}
      confirmedMappings={mappings ?? []}
    />
  )
}
