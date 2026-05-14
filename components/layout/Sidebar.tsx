'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, Package, ChefHat, Calendar, Upload, ClipboardList, FileText, Users,
  LogOut, ChevronDown, ChevronRight, TrendingUp, Shirt,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'

interface NavItem {
  label: string
  href?: string
  icon: React.ReactNode
  color?: string
  children?: { label: string; href: string }[]
}

const navItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard', icon: <LayoutDashboard size={16} />, color: '#602460' },
  {
    label: 'Logbook', icon: <BookOpen size={16} />, color: '#16a34a', children: [
      { label: 'Journal',      href: '/logbook' },
      { label: 'Statistique',  href: '/logbook/statistique' },
    ],
  },
  { label: 'Blanchisserie', href: '/laundry', icon: <Shirt size={16} />, color: '#0ea5e9' },
  {
    label: 'Cost Control', icon: <TrendingUp size={16} />, color: '#0ea5e9', children: [
      { label: 'Stats F&B',  href: '/cost-control/stats-fb' },
      { label: 'Cost Room',  href: '/cost-control/cost-room' },
      { label: 'Cost Food',  href: '/cost-control/cost-food' },
      { label: 'Cost Bev',   href: '/cost-control/cost-bev' },
      { label: 'Cost RH',    href: '/cost-control/cost-rh' },
    ],
  },
  {
    label: 'Inventaire', icon: <Package size={16} />, color: '#602460', children: [
      { label: 'Chambres',          href: '/inventory/rooms' },
      { label: 'Boissons',          href: '/inventory/beverages' },
      { label: 'Alimentation',      href: '/inventory/food' },
      { label: 'Nettoyage F&B',     href: '/inventory/cleaning-fb' },
      { label: 'Nettoyage général', href: '/inventory/cleaning-general' },
      { label: 'Réunion',           href: '/inventory/meeting' },
      { label: 'Blanchisserie',     href: '/inventory/laundry' },
      { label: 'Ingrédients',       href: '/inventory/ingredients' },
    ],
  },
  { label: 'Recettes',     href: '/recipes',              icon: <ChefHat size={16} />,      color: '#d97706' },
  {
    label: 'Planning', icon: <Calendar size={16} />, color: '#0284c7', children: [
      { label: 'Tableau de service', href: '/duty-roster' },
    ],
  },
  { label: 'Upload F&B',    href: '/upload-fb',            icon: <Upload size={16} />,       color: '#e11d48' },
  {
    label: 'Réquisitions', icon: <ClipboardList size={16} />, color: '#0284c7', children: [
      { label: 'Créer',      href: '/requisitions' },
      { label: 'Commande',   href: '/requisitions/commande' },
      { label: 'Valider',    href: '/requisitions/validate' },
    ],
  },
  { label: 'Factures',     href: '/invoices',             icon: <FileText size={16} />,     color: '#16a34a' },
  { label: 'Utilisateurs', href: '/users',                icon: <Users size={16} />,        color: '#7B6B80' },
]

interface SidebarProps {
  user: UserProfile | null
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [expanded, setExpanded] = useState<string[]>(['Inventaire'])

  const toggleSection = (label: string) => {
    setExpanded(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <aside
      className="flex flex-col flex-shrink-0"
      style={{ width: 240, background: '#FFFFFF', minHeight: '100vh', borderRight: '1px solid #E5E2D8' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#E5E2D8]">
        <div className="text-[15px] font-bold tracking-widest uppercase text-[#602460]">MERCURE</div>
        <div className="text-[11px] tracking-wide mt-0.5 text-[#B0A5B4]">Hotels Operations</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {navItems.map(item => {
          if (!item.children) {
            const active = item.href ? isActive(item.href) : false
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] mb-0.5 transition-all ${
                  active
                    ? 'bg-[#602460]/10 text-[#602460] border-l-2 pl-[10px] border-[#602460]'
                    : 'text-[#7B6B80] hover:bg-[#F4F2ED] hover:text-[#3D1640]'
                }`}
              >
                <span className="flex-shrink-0" style={{ color: active ? (item.color ?? '#602460') : undefined }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          }

          const isOpen = expanded.includes(item.label)
          const anyChildActive = item.children.some(c => isActive(c.href))

          return (
            <div key={item.label} className="mb-0.5">
              <button
                onClick={() => toggleSection(item.label)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-all ${
                  anyChildActive ? 'text-[#3D1640]' : 'text-[#7B6B80] hover:bg-[#F4F2ED] hover:text-[#3D1640]'
                }`}
              >
                <span className="flex-shrink-0" style={{ color: anyChildActive ? (item.color ?? '#602460') : undefined }}>{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {isOpen
                  ? <ChevronDown size={12} className="text-[#B0A5B4]" />
                  : <ChevronRight size={12} className="text-[#B0A5B4]" />}
              </button>
              {isOpen && (
                <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                  {item.children.map(child => {
                    const active = isActive(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`px-3 py-1.5 rounded-md text-[12px] transition-all ${
                          active
                            ? 'bg-[#602460]/10 text-[#602460] border-l-2 pl-[10px] border-[#602460]'
                            : 'text-[#B0A5B4] hover:bg-[#F4F2ED] hover:text-[#3D1640]'
                        }`}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-[#E5E2D8]">
        {user && (
          <div className="mb-3">
            <p className="text-[#3D1640] text-[13px] font-medium truncate">{user.full_name}</p>
            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-[#602460]/10 text-[#602460] font-semibold uppercase tracking-wide border border-[#602460]/20">
              {user.role}
            </span>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-[#B0A5B4] hover:text-red-500 text-[13px] transition-colors"
        >
          <LogOut size={14} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
