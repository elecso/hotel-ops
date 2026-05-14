'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileText, Wrench, ChefHat, BedDouble, Users, Glasses, Phone, Plus, Trash2, ExternalLink, Upload } from 'lucide-react'
import type { Tutorial, TutorialContact } from '@/lib/types'

type Category = 'technique' | 'fb' | 'rooms' | 'rh' | 'banquet' | 'contact'

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { id: 'technique', label: 'Technique',  icon: <Wrench size={24} />,    color: '#16a34a', bg: '#dcfce7' },
  { id: 'fb',        label: 'F&B',        icon: <ChefHat size={24} />,   color: '#d97706', bg: '#fef3c7' },
  { id: 'rooms',     label: 'Rooms',      icon: <BedDouble size={24} />, color: '#0284c7', bg: '#e0f2fe' },
  { id: 'rh',        label: 'RH',         icon: <Users size={24} />,     color: '#7c3aed', bg: '#ede9fe' },
  { id: 'banquet',   label: 'Banquet',    icon: <Glasses size={24} />,   color: '#e11d48', bg: '#ffe4e6' },
  { id: 'contact',   label: 'Contact',    icon: <Phone size={24} />,     color: '#602460', bg: '#f3e8ff' },
]

interface Props {
  tutorials: Tutorial[]
  contacts: TutorialContact[]
  isAdmin: boolean
}

export function TutorialClient({ tutorials: initial, contacts: initialContacts, isAdmin }: Props) {
  const supabase = createClient()
  const [selected, setSelected] = useState<Category>('technique')
  const [tutorials, setTutorials] = useState<Tutorial[]>(initial)
  const [contacts, setContacts] = useState<TutorialContact[]>(initialContacts)

  // Add tutorial form
  const [showAddTutorial, setShowAddTutorial] = useState(false)
  const [tutForm, setTutForm] = useState({ title: '', description: '' })
  const [tutFile, setTutFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  // Add contact form
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '', other: '' })
  const [savingContact, setSavingContact] = useState(false)

  const handleAddTutorial = async () => {
    if (!tutForm.title.trim() || !tutFile) return
    setSaving(true)
    try {
      const path = `${selected}/${Date.now()}-${tutFile.name}`
      const { data: storageData, error: uploadError } = await supabase.storage
        .from('Tutorial')
        .upload(path, tutFile, { contentType: tutFile.type || 'application/pdf' })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('Tutorial').getPublicUrl(storageData.path)

      const { data } = await supabase.from('tutorials').insert({
        category: selected as Tutorial['category'],
        title: tutForm.title.trim(),
        description: tutForm.description.trim() || null,
        file_url: urlData.publicUrl,
      }).select().single()
      if (data) setTutorials(prev => [...prev, data])
      setShowAddTutorial(false)
      setTutForm({ title: '', description: '' })
      setTutFile(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTutorial = async (id: number) => {
    await supabase.from('tutorials').delete().eq('id', id)
    setTutorials(prev => prev.filter(t => t.id !== id))
  }

  const handleAddContact = async () => {
    if (!contactForm.name.trim()) return
    setSavingContact(true)
    try {
      const { data } = await supabase.from('tutorial_contacts').insert({
        name: contactForm.name.trim(),
        phone: contactForm.phone.trim() || null,
        email: contactForm.email.trim() || null,
        other: contactForm.other.trim() || null,
      }).select().single()
      if (data) setContacts(prev => [...prev, data])
      setShowAddContact(false)
      setContactForm({ name: '', phone: '', email: '', other: '' })
    } finally {
      setSavingContact(false)
    }
  }

  const handleDeleteContact = async (id: number) => {
    await supabase.from('tutorial_contacts').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  const filteredTutorials = tutorials.filter(t => t.category === selected)
  const cat = CATEGORIES.find(c => c.id === selected)!

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: '#C5C0B1' }}>Ressources</p>
        <h2 className="text-2xl font-bold" style={{ color: '#602460' }}>Tutoriels & Contacts</h2>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CATEGORIES.map(c => {
          const count = c.id === 'contact' ? contacts.length : tutorials.filter(t => t.category === c.id).length
          const isActive = selected === c.id
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className="rounded-xl p-4 text-left transition-all border-2"
              style={{
                background: isActive ? c.color : c.bg,
                borderColor: isActive ? c.color : 'transparent',
                boxShadow: isActive ? `0 4px 12px ${c.color}40` : undefined,
              }}
            >
              <div className="mb-2" style={{ color: isActive ? '#fff' : c.color }}>{c.icon}</div>
              <p className="text-sm font-semibold" style={{ color: isActive ? '#fff' : c.color }}>{c.label}</p>
              <p className="text-xs mt-0.5" style={{ color: isActive ? 'rgba(255,255,255,0.75)' : '#B0A5B4' }}>
                {count} {c.id === 'contact' ? 'contact(s)' : 'tutoriel(s)'}
              </p>
            </button>
          )
        })}
      </div>

      {/* Content panel */}
      <div className="rounded-xl border border-[#E5E2D8] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span style={{ color: cat.color }}>{cat.icon}</span>
            <h3 className="text-lg font-bold" style={{ color: '#3D1640' }}>{cat.label}</h3>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (selected === 'contact') { setShowAddContact(v => !v); setShowAddTutorial(false) }
                else { setShowAddTutorial(v => !v); setShowAddContact(false) }
              }}
            >
              <Plus size={14} />
              {selected === 'contact' ? 'Ajouter un contact' : 'Ajouter un tutoriel'}
            </Button>
          )}
        </div>

        {/* Add tutorial form */}
        {showAddTutorial && selected !== 'contact' && (
          <div className="rounded-lg border border-[#E5E2D8] p-4 space-y-3 bg-[#FAFAF8]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Titre *</Label>
                <Input value={tutForm.title} onChange={e => setTutForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre du tutoriel" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={tutForm.description} onChange={e => setTutForm(f => ({ ...f, description: e.target.value }))} placeholder="Description courte" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fichier PDF *</Label>
              <div
                className="border-2 border-dashed border-[#E5E2D8] rounded-lg p-4 text-center cursor-pointer hover:border-[#602460] transition-colors"
                onClick={() => document.getElementById('tut-upload')?.click()}
              >
                <Upload size={18} className="mx-auto mb-1 text-[#B0A5B4]" />
                <p className="text-xs text-[#B0A5B4]">{tutFile ? tutFile.name : 'Cliquer pour sélectionner un PDF'}</p>
                <input id="tut-upload" type="file" accept=".pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setTutFile(f) }} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddTutorial} disabled={saving || !tutForm.title.trim() || !tutFile}>
                {saving ? 'Envoi…' : 'Enregistrer'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddTutorial(false)}>Annuler</Button>
            </div>
          </div>
        )}

        {/* Add contact form */}
        {showAddContact && selected === 'contact' && (
          <div className="rounded-lg border border-[#E5E2D8] p-4 space-y-3 bg-[#FAFAF8]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom *</Label>
                <Input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom complet" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Téléphone</Label>
                <Input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="+33 6 00 00 00 00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemple.com" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Autre (poste, service…)</Label>
                <Input value={contactForm.other} onChange={e => setContactForm(f => ({ ...f, other: e.target.value }))} placeholder="Ex: Directeur, Ext. 201" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddContact} disabled={savingContact || !contactForm.name.trim()}>
                {savingContact ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddContact(false)}>Annuler</Button>
            </div>
          </div>
        )}

        {/* Tutorial grid */}
        {selected !== 'contact' && (
          filteredTutorials.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: '#C5C0B1' }}>Aucun tutoriel dans cette catégorie.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTutorials.map(t => (
                <div key={t.id} className="rounded-xl border border-[#E5E2D8] p-4 space-y-2 hover:border-[#602460]/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} style={{ color: cat.color, flexShrink: 0 }} />
                      <p className="text-sm font-semibold text-[#3D1640] truncate">{t.title}</p>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleDeleteTutorial(t.id)} className="p-1 text-[#C5C0B1] hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  {t.description && <p className="text-xs text-[#B0A5B4]">{t.description}</p>}
                  {t.file_url && (
                    <a
                      href={t.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                      style={{ background: cat.bg, color: cat.color }}
                    >
                      <ExternalLink size={12} /> Voir le PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Contact table */}
        {selected === 'contact' && (
          contacts.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: '#C5C0B1' }}>Aucun contact enregistré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: '#F4F2ED' }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-[#3D1640] rounded-tl-lg">Nom</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-[#3D1640]">Téléphone</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-[#3D1640]">Email</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-[#3D1640]">Autre</th>
                    {isAdmin && <th className="px-4 py-2.5 rounded-tr-lg"></th>}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF8]'}>
                      <td className="px-4 py-2.5 font-medium text-[#3D1640] border-b border-[#F4F2ED]">{c.name}</td>
                      <td className="px-4 py-2.5 text-[#7B6B80] border-b border-[#F4F2ED]">{c.phone ?? '—'}</td>
                      <td className="px-4 py-2.5 border-b border-[#F4F2ED]">
                        {c.email
                          ? <a href={`mailto:${c.email}`} className="text-[#0284c7] hover:underline">{c.email}</a>
                          : <span className="text-[#B0A5B4]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[#7B6B80] border-b border-[#F4F2ED]">{c.other ?? '—'}</td>
                      {isAdmin && (
                        <td className="px-4 py-2.5 border-b border-[#F4F2ED]">
                          <button onClick={() => handleDeleteContact(c.id)} className="p-1 text-[#C5C0B1] hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
