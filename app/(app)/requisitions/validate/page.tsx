import { createClient } from '@/lib/supabase/server'
import { ValidateRequisitionsClient } from './ValidateRequisitionsClient'

export default async function ValidateRequisitionsPage() {
  const supabase = await createClient()

  const { data: requisitions } = await supabase
    .from('requisitions')
    .select(`
      *,
      requester:user_profiles!requested_by(full_name, role),
      lines:requisition_lines(*, product:products(id, name, unit))
    `)
    .eq('status', 'pending')
    .order('request_date', { ascending: false })

  return <ValidateRequisitionsClient requisitions={requisitions ?? []} />
}
