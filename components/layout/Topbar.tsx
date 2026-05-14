'use client'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import type { UserProfile } from '@/lib/types'

const routeLabels: Record<string, string> = {
  '/dashboard':                  'Tableau de bord',
  '/logbook':                    'Logbook',
  '/inventory/rooms':            'Inventaire — Chambres',
  '/inventory/beverages':        'Inventaire — Boissons',
  '/inventory/food':             'Inventaire — Alimentation',
  '/inventory/cleaning-fb':      'Inventaire — Nettoyage F&B',
  '/inventory/cleaning-general': 'Inventaire — Nettoyage général',
  '/inventory/meeting':          'Inventaire — Réunion',
  '/inventory/laundry':          'Inventaire — Blanchisserie',
  '/recipes':                    'Recettes',
  '/duty-roster':                'Tableau de service',
  '/duty-roster/cost':           'Coûts & Statistiques',
  '/upload-fb':                  'Upload F&B',
  '/requisitions':               'Réquisitions',
  '/requisitions/validate':      'Valider les réquisitions',
  '/invoices':                   'Factures',
  '/users':                      'Utilisateurs',
}

interface TopbarProps {
  user: UserProfile | null
}

export function Topbar({ user }: TopbarProps) {
  const pathname = usePathname()
  const title = routeLabels[pathname] ?? 'Mercure Hotels'

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1)

  return (
    <header
      className="flex items-center justify-between px-6 h-14 border-b flex-shrink-0"
      style={{ background: '#FFFFFF', borderColor: '#E5E2D8' }}
    >
      <h1 className="text-[15px] font-semibold text-[#3D1640]">
        {title}
      </h1>
      <div className="flex items-center gap-4">
        <span className="text-[13px] hidden sm:block text-[#B0A5B4]">
          {todayCapitalized}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant="mercure">MERCURE</Badge>
          <Badge variant="ibis">IBIS</Badge>
        </div>
        {user && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: '#602460' }}
            title={user.full_name}
          >
            {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
        )}
      </div>
    </header>
  )
}
