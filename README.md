# Mercure Hotels — Système de Gestion Opérationnelle

Full-stack hotel operations management system for **Mercure Lyon** and **Ibis Lyon**.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Supabase** (PostgreSQL + Auth + Storage)
- **Tailwind CSS v4** (Mercure brand tokens)
- **Anthropic Claude API** (`claude-sonnet-4-20250514`) — invoice & F&B parsing
- **Resend** — stock alert emails

---

## Setup

### 1. Clone & install

```bash
cd hotel-ops
npm install
```

### 2. Configure environment

Copy `.env.local.example` to `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=operations@your-domain.com
ALERT_EMAIL_TO=gm@your-domain.com
```

### 3. Set up Supabase

1. Create a new Supabase project
2. In **SQL Editor**, run the full schema: `supabase/schema.sql`
3. In **Storage**, create a bucket named `invoices` (set to private)
4. Enable **Row Level Security** (already configured in schema)

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

---

## Features

| Route | Description |
|---|---|
| `/dashboard` | KPIs, events, 10-day forecast, yesterday's results |
| `/logbook` | News (N8n), morning meeting, toilet checks |
| `/inventory/*` | Stock management (7 categories), AI-assisted stock alerts |
| `/recipes` | Recipe CRUD with ingredient management |
| `/duty-roster` | Weekly duty roster with CSV import |
| `/duty-roster/cost` | Staffing cost statistics |
| `/upload-fb` | F&B sales upload with Claude AI parsing |
| `/requisitions` | Create & validate purchase requisitions |
| `/invoices` | Invoice upload with Claude AI line extraction |
| `/users` | User management (admin only) |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/logbook/news` | Inject news (N8n webhook) |
| `POST` | `/api/logbook/morning-meeting` | Inject meeting notes (N8n) |
| `POST` | `/api/upload-fb/parse` | Parse F&B file with Claude |
| `POST` | `/api/invoices/parse` | Parse invoice PDF with Claude |
| `POST` | `/api/stock/check-alerts` | Trigger stock alert emails |
| `POST` | `/api/users/create` | Create user (admin only) |
| `POST` | `/api/users/deactivate` | Deactivate user (admin only) |

## Roles

| Role | Access |
|---|---|
| `admin` | Full access + stock edits + user management |
| `manager` | Validate requisitions & invoices, all views |
| `staff` | Create requisitions, upload F&B/invoices |
| `readonly` | Dashboard + Logbook only |

## N8n Integration

The logbook API endpoints accept `POST` requests with service role authentication:

```json
POST /api/logbook/news
{
  "date": "2026-05-13",
  "title": "Titre de l'actu",
  "body": "Contenu...",
  "source": "n8n"
}
```

```json
POST /api/logbook/morning-meeting
{
  "date": "2026-05-13",
  "notes": "Points discutés...",
  "attendees": ["Alice", "Bob"]
}
```
