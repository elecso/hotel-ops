import { createClient } from '@/lib/supabase/server'
import { TutorialClient } from './TutorialClient'

export default async function TutorialPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user?.id ?? '').single()

  const [{ data: tutorials }, { data: contacts }] = await Promise.all([
    supabase.from('tutorials').select('*').order('created_at', { ascending: true }),
    supabase.from('tutorial_contacts').select('*').order('name', { ascending: true }),
  ])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'

  return (
    <TutorialClient
      tutorials={tutorials ?? []}
      contacts={contacts ?? []}
      isAdmin={isAdmin}
    />
  )
}
