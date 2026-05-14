'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, Package, ChefHat, Calendar, Upload, ClipboardList, FileText, Users,
  LogOut, ChevronDown, ChevronRight,
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
  { label: 'Tableau de bord', href: '/dashboard', icon: <LayoutDashboard size={16} />, color: '#22d3ee' },
  { label: 'Logbook',         href: '/logbook',   icon: <BookOpen size={16} />,        color: '#4ade80' },
  {
    label: 'Inventaire', icon: <Package size={16} />, color: '#a855f7', children: [
      { label: 'Chambres',          href: '/inventory/rooms' },
      { label: 'Boissons',          href: '/inventory/beverages' },
      { label: 'Alimentation',      href: '/inventory/food' },
      { label: 'Nettoyage F&B',     href: '/inventory/cleaning-fb' },
      { label: 'Nettoyage général', href: '/inventory/cleaning-general' },
      { label: 'Réunion',           href: '/inventory/meeting' },
      { label: 'Blanchisserie',     href: '/inventory/laundry' },
    ],
  },
  { label: 'Recettes', href: '/recipes', icon: <ChefHat size={16} />, color: '#fb923c' },
  {
    label: 'Planning', icon: <Calendar size={16} />, color: '#fbbf24', children: [
      { label: 'Tableau de service', href: '/duty-roster' },
      { label: 'Coûts & Stats',      href: '/duty-roster/cost' },
    ],
  },
  { label: 'Upload F&B', href: '/upload-fb', icon: <Upload size={16} />, color: '#f43f5e' },
  {
    label: 'Réquisitions', icon: <ClipboardList size={16} />, color: '#22d3ee', children: [
      { label: 'Créer',   href: '/requisitions' },
      { label: 'Valider', href: '/requisitions/validate' },
    ],
  },
  { label: 'Factures',     href: '/invoices', icon: <FileText size={16} />, color: '#4ade80' },
  { label: 'Utilisateurs', href: '/users',    icon: <Users size={16} />,    color: '#8080a8' },
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
      style={{ width: 240, background: '#0e0e24', minHeight: '100vh', borderRight: '1px solid #1e1e3c' }}
      className="flex flex-col flex-shrink-0"
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[#1e1e3c]">
        <div className="text-white font-bold text-lg tracking-widest uppercase" style={{ color: '#a855f7' }}>MERCURE</div>
        <div className="text-[11px] tracking-wide mt-0.5" style={{ color: '#4a4a6a' }}>Hotels Operations</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {navItems.map(item => {
          if (!item.children) {
            const active = item.href ? isActive(item.href) : false
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] mb-0.5 transition-all ${
                  active
                    ? 'bg-[#1e1050] text-white border-l-2 pl-[10px]'
                    : 'text-[#8080a8] hover:bg-[#14142b] hover:text-[#e2e2f0]'
                }`}
                style={active ? { borderLeftColor: item.color ?? '#a855f7' } : {}}
              >
                <span className="flex-shrink-0" style={{ color: active ? (item.color ?? '#a855f7') : undefined }}>{item.icon}</span>
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
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-all ${
                  anyChildActive ? 'text-[#e2e2f0]' : 'text-[#8080a8] hover:bg-[#14142b] hover:text-[#e2e2f0]'
                }`}
              >
                <span className="flex-shrink-0" style={{ color: anyChildActive ? (item.color ?? '#a855f7') : undefined }}>{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {isOpen
                  ? <ChevronDown size={12} style={{ color: '#4a4a6a' }} />
                  : <ChevronRight size={12} style={{ color: '#4a4a6a' }} />}
              </button>
              {isOpen && (
                <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                  {item.children.map(child => {
                    const active = isActive(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`px-3 py-1.5 rounded-[6px] text-[12px] transition-all ${
                          active
                            ? 'bg-[#1e1050] text-white border-l-2 pl-[10px]'
                            : 'text-[#5a5a78] hover:bg-[#14142b] hover:text-[#e2e2f0]'
                        }`}
                        style={active ? { borderLeftColor: item.color ?? '#a855f7' } : {}}
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
      <div className="px-4 py-4 border-t border-[#1e1e3c]">
        {user && (
          <div className="mb-3">
            <p className="text-[#e2e2f0] text-[13px] font-medium truncate">{user.full_name}</p>
            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-[#1e1050] text-[#a855f7] font-semibold uppercase tracking-wide border border-[#a855f7]/30">
              {user.role}
            </span>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-[#4a4a6a] hover:text-[#f87171] text-[13px] transition-colors"
        >
          <LogOut size={14} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
