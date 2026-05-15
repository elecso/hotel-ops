import { createAdminClient, createClient } from '@/lib/supabase/server'
import { ToValidateClient } from './ToValidateClient'

export default async function InvoicesToValidatePage() {
  const [admin, supabase] = await Promise.all([createAdminClient(), createClient()])

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: fileList },
    { data: suppliers },
    { data: products },
    { data: mappings },
  ] = await Promise.all([
    admin.storage.from('invoices').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } }),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('products').select('id, name, unit, type').eq('is_active', true).order('name'),
    supabase.from('product_ai_mappings').select('raw_name, product_id').eq('confirmed', true),
  ])

  const files = (fileList ?? []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => ({
    name: f.name,
    path: f.name,
    size: f.metadata?.size ?? 0,
    createdAt: f.created_at ?? '',
  }))

  return (
    <ToValidateClient
      files={files}
      suppliers={suppliers ?? []}
      products={products ?? []}
      confirmedMappings={mappings ?? []}
      userId={user?.id ?? ''}
    />
  )
}
