'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Identifiants incorrects. Veuillez réessayer.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden"
        style={{ background: '#602460' }}
      >
        {/* Watermark M */}
        <div
          className="absolute text-[32rem] font-black select-none pointer-events-none"
          style={{ color: 'rgba(223,219,207,0.08)', lineHeight: 1, bottom: '-4rem', right: '-4rem' }}
        >
          M
        </div>
        <div className="relative z-10 text-center px-12">
          <div className="text-white font-black text-5xl tracking-widest uppercase mb-2">MERCURE</div>
          <div className="text-[#DFDBCF] text-xl tracking-widest font-light">Hotels</div>
          <div className="mt-10 w-12 h-0.5 bg-[#DFDBCF] mx-auto" />
          <p className="mt-8 text-[#DFDBCF]/70 text-sm leading-relaxed max-w-xs">
            Système de gestion opérationnelle<br />Mercure & Ibis Lyon
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8" style={{ background: '#FFFFFF' }}>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="text-2xl font-black tracking-widest uppercase" style={{ color: '#602460' }}>MERCURE</div>
            <div className="text-sm tracking-wider" style={{ color: '#C5C0B1' }}>Hotels</div>
          </div>

          <h2 className="text-2xl font-semibold mb-1" style={{ color: '#3D1640' }}>Connexion</h2>
          <p className="text-sm mb-8" style={{ color: '#C5C0B1' }}>Accès réservé au personnel autorisé</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="prenom.nom@mercure.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px] px-3 py-2">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
