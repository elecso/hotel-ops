import { createClient, createAdminClient } from '@/lib/supabase/server'
import { UsersClient } from './UsersClient'

export default async function UsersPage() {
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch emails from auth.users via admin
  const { data: authUsers } = await adminClient.auth.admin.listUsers()
  const emailMap = Object.fromEntries(
    (authUsers?.users ?? []).map(u => [u.id, u.email])
  )

  const users = (profiles ?? []).map(p => ({
    ...p,
    email: emailMap[p.id] ?? '',
  }))

  return <UsersClient users={users} />
}
