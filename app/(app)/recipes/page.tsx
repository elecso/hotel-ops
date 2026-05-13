import { createClient } from '@/lib/supabase/server'
import { RecipesClient } from './RecipesClient'

export default async function RecipesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user?.id ?? '').single()

  const [
    { data: recipes },
    { data: foodProducts },
  ] = await Promise.all([
    supabase
      .from('recipes')
      .select('*, ingredients:recipe_ingredients(*, product:products(id, name, unit)), menu_items(*)')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, unit')
      .eq('type', 'food')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <RecipesClient
      recipes={recipes ?? []}
      foodProducts={foodProducts ?? []}
      isManager={profile?.role === 'admin' || profile?.role === 'manager'}
    />
  )
}
