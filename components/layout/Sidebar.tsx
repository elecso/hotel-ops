'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, Package, ChefHat, Calendar, Upload, ClipboardList, FileText, Users,
  LogOut, ChevronDown, ChevronRight, FlaskConical, Shirt, Leaf, Wind, Wrench
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'

interface NavItem {
  label: string
  href?: string
  icon: React.ReactNode
  children?: { label: string; href: string }[]
}

const navItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard', icon: <LayoutDashboard size={16} /> },
  { label: 'Logbook', href: '/logbook', icon: <BookOpen size={16} /> },
  {
    label: 'Inventaire', icon: <Package size={16} />, children: [
      { label: 'Chambres', href: '/inventory/rooms' },
      { label: 'Boissons', href: '/inventory/beverages' },
      { label: 'Alimentation', href: '/inventory/food' },
      { label: 'Nettoyage F&B', href: '/inventory/cleaning-fb' },
      { label: 'Nettoyage général', href: '/inventory/cleaning-general' },
      { label: 'Réunion', href: '/inventory/meeting' },
      { label: 'Blanchisserie', href: '/inventory/laundry' },
    ],
  },
  { label: 'Recettes', href: '/recipes', icon: <ChefHat size={16} /> },
  {
    label: 'Planning', icon: <Calendar size={16} />, children: [
      { label: 'Tableau de service', href: '/duty-roster' },
      { label: 'Coûts & Stats', href: '/duty-roster/cost' },
    ],
  },
  { label: 'Upload F&B', href: '/upload-fb', icon: <Upload size={16} /> },
  {
    label: 'Réquisitions', icon: <ClipboardList size={16} />, children: [
      { label: 'Créer', href: '/requisitions' },
      { label: 'Valider', href: '/requisitions/validate' },
    ],
  },
  { label: 'Factures', href: '/invoices', icon: <FileText size={16} /> },
  { label: 'Utilisateurs', href: '/users', icon: <Users size={16} /> },
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
      style={{ width: 240, background: '#602460', minHeight: '100vh' }}
      className="flex flex-col flex-shrink-0"
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[#7E3A7E]">
        <div className="text-white font-bold text-lg tracking-widest uppercase">MERCURE</div>
        <div className="text-[#DFDBCF] text-xs tracking-wide mt-0.5">Hotels</div>
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
                className={`flex items-center gap-3 px-3 py-2 rounded text-[14px] mb-0.5 transition-colors ${
                  active
                    ? 'bg-[#3D1640] text-white border-l-[3px] border-[#DFDBCF] pl-[9px]'
                    : 'text-white/90 hover:bg-white/[0.08]'
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
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
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-[14px] transition-colors ${
                  anyChildActive ? 'text-white' : 'text-white/90 hover:bg-white/[0.08]'
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {isOpen && (
                <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                  {item.children.map(child => {
                    const active = isActive(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`px-3 py-1.5 rounded text-[13px] transition-colors ${
                          active
                            ? 'bg-[#3D1640] text-white border-l-[3px] border-[#DFDBCF] pl-[9px]'
                            : 'text-white/75 hover:bg-white/[0.08] hover:text-white'
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
      <div className="px-4 py-4 border-t border-[#7E3A7E]">
        {user && (
          <div className="mb-3">
            <p className="text-white text-[13px] font-medium truncate">{user.full_name}</p>
            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-[#DFDBCF] text-[#3D1640] font-semibold uppercase tracking-wide">
              {user.role}
            </span>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-white/70 hover:text-white text-[13px] transition-colors"
        >
          <LogOut size={14} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
