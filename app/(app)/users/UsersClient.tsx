'use client'
import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, UserX } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { UserProfile } from '@/lib/types'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', staff: 'Staff', readonly: 'Lecture seule',
}
const HOTEL_LABELS: Record<string, string> = {
  mercure: 'Mercure', ibis: 'Ibis', both: 'Les deux',
}

const ROLE_BADGE: Record<string, 'admin' | 'manager' | 'staff' | 'readonly'> = {
  admin: 'admin', manager: 'manager', staff: 'staff', readonly: 'readonly',
}

interface Props {
  users: (UserProfile & { email: string })[]
}

interface NewUserForm {
  full_name: string
  email: string
  password: string
  role: string
  hotel_access: string
}

export function UsersClient({ users: initial }: Props) {
  const [users, setUsers] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<NewUserForm>({
    full_name: '', email: '', password: '', role: 'staff', hotel_access: 'both',
  })

  const set = (key: keyof NewUserForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleCreate = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const { error: msg } = await res.json()
        throw new Error(msg ?? 'Erreur')
      }
      const { user } = await res.json()
      setUsers(prev => [{ ...user, email: form.email }, ...prev])
      setShowModal(false)
      setForm({ full_name: '', email: '', password: '', role: 'staff', hotel_access: 'both' })
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    await fetch('/api/users/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowModal(true)}><Plus size={16} /> Nouvel utilisateur</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Accès hôtel</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8" style={{ color: '#C5C0B1' }}>
                    Aucun utilisateur.
                  </TableCell>
                </TableRow>
              ) : users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-sm font-mono" style={{ color: '#C5C0B1' }}>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_BADGE[u.role] ?? 'default'}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.hotel_access === 'mercure' ? <Badge variant="mercure">Mercure</Badge>
                      : u.hotel_access === 'ibis' ? <Badge variant="ibis">Ibis</Badge>
                      : <span className="text-sm" style={{ color: '#C5C0B1' }}>Les deux</span>}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(u.created_at)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeactivate(u.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <UserX size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={o => !o && setShowModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un utilisateur</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
            <div className="space-y-1.5">
              <Label>Nom complet *</Label>
              <Input value={form.full_name} onChange={set('full_name')} placeholder="Prénom Nom" />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="prenom.nom@hotel.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Mot de passe *</Label>
              <Input type="password" value={form.password} onChange={set('password')} placeholder="Minimum 8 caractères" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rôle</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="readonly">Lecture seule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Accès hôtel</Label>
                <Select value={form.hotel_access} onValueChange={v => setForm(f => ({ ...f, hotel_access: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Les deux</SelectItem>
                    <SelectItem value="mercure">Mercure</SelectItem>
                    <SelectItem value="ibis">Ibis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving || !form.full_name || !form.email || !form.password}>
              {saving ? 'Création…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
