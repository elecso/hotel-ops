-- ============================================================
-- HOTEL OPS — FORECAST SCHEMA
-- Run this in Supabase SQL Editor (Settings → SQL Editor)
--
-- After running, go to:
--   Supabase Dashboard → Project Settings → API → Exposed Schemas
--   Add "forecast" to the list, then save.
-- ============================================================

-- ============================================================
-- SCHEMA
-- ============================================================
create schema if not exists forecast;

-- Grant schema usage to PostgREST roles (required for Supabase API)
grant usage on schema forecast to anon, authenticated, service_role;

-- ============================================================
-- forecast.occupancy
-- Daily occupancy forecast per hotel (already existed — safe to re-run)
-- ============================================================
create table if not exists forecast.occupancy (
  id               bigserial primary key,
  forecast_date    date        not null,
  hotel_id         text        not null references hotels(id),
  occupancy_pct    numeric(5,2),
  rooms_sold       int,
  adr              numeric(10,2),  -- Average Daily Rate (€)
  revpar           numeric(10,2),  -- Revenue Per Available Room (€)
  breakfast_covers int,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique(forecast_date, hotel_id)
);

-- ============================================================
-- forecast.fb_covers
-- F&B covers & revenue forecast by outlet and day
-- ============================================================
create table if not exists forecast.fb_covers (
  id            bigserial primary key,
  forecast_date date        not null,
  hotel_id      text        not null references hotels(id),
  outlet        text        not null
    check (outlet in (
      'breakfast_mercure', 'breakfast_ibis',
      'lunch', 'dinner', 'room_service',
      'banqueting_lunch', 'banqueting_dinner'
    )),
  covers        int,
  revenue       numeric(10,2),
  created_at    timestamptz default now(),
  unique(forecast_date, hotel_id, outlet)
);

-- ============================================================
-- forecast.monthly_budget
-- Monthly budget / revenue targets per hotel
-- ============================================================
create table if not exists forecast.monthly_budget (
  id                 serial primary key,
  budget_month       date        not null,  -- first day of month, e.g. 2025-06-01
  hotel_id           text        not null references hotels(id),
  -- Rooms
  rooms_revenue      numeric(12,2),
  rooms_sold         int,
  occupancy_target   numeric(5,2),          -- target occupancy %
  adr_target         numeric(10,2),         -- target Average Daily Rate
  -- F&B
  fb_revenue         numeric(12,2),
  breakfast_covers   int,
  restaurant_covers  int,
  banqueting_covers  int,
  -- Costs
  payroll_budget     numeric(12,2),
  supplies_budget    numeric(12,2),
  -- Total
  total_revenue      numeric(12,2),
  notes              text,
  created_at         timestamptz default now(),
  unique(budget_month, hotel_id)
);

-- ============================================================
-- forecast.demand_events
-- External events that drive or affect demand (fairs, concerts,
-- trade shows, sports, public holidays, etc.)
-- ============================================================
create table if not exists forecast.demand_events (
  id             serial primary key,
  event_date     date not null,
  event_end_date date,           -- null = single day
  hotel_id       text,           -- null = affects both hotels
  event_name     text not null,
  impact_level   text check (impact_level in ('low','medium','high','peak')),
  expected_rooms int,            -- expected additional rooms sold
  notes          text,
  created_at     timestamptz default now()
);

-- ============================================================
-- GRANT TABLE PERMISSIONS TO PostgREST ROLES
-- ============================================================
grant select, insert, update, delete
  on all tables in schema forecast
  to authenticated;

grant select
  on all tables in schema forecast
  to anon;

grant all
  on all tables in schema forecast
  to service_role;

-- Grant sequence usage for bigserial/serial columns
grant usage, select
  on all sequences in schema forecast
  to authenticated, service_role;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table forecast.occupancy      enable row level security;
alter table forecast.fb_covers      enable row level security;
alter table forecast.monthly_budget enable row level security;
alter table forecast.demand_events  enable row level security;

-- All authenticated users can read forecasts
create policy "forecast_occupancy_read"
  on forecast.occupancy for select
  using (auth.role() = 'authenticated');

create policy "forecast_fb_covers_read"
  on forecast.fb_covers for select
  using (auth.role() = 'authenticated');

create policy "forecast_monthly_budget_read"
  on forecast.monthly_budget for select
  using (auth.role() = 'authenticated');

create policy "forecast_demand_events_read"
  on forecast.demand_events for select
  using (auth.role() = 'authenticated');

-- Admin and manager can write forecast data
create policy "forecast_occupancy_write"
  on forecast.occupancy for all
  using (get_my_role() in ('admin','manager'));

create policy "forecast_fb_covers_write"
  on forecast.fb_covers for all
  using (get_my_role() in ('admin','manager'));

create policy "forecast_monthly_budget_write"
  on forecast.monthly_budget for all
  using (get_my_role() in ('admin','manager'));

create policy "forecast_demand_events_write"
  on forecast.demand_events for all
  using (get_my_role() in ('admin','manager'));

-- ============================================================
-- HELPER: auto-update updated_at on forecast.occupancy
-- ============================================================
create or replace function forecast.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on forecast.occupancy;
create trigger set_updated_at
  before update on forecast.occupancy
  for each row execute function forecast.set_updated_at();

-- ============================================================
-- SEED: insert the next 30 days of blank forecast rows
-- (so the dashboard shows something immediately — edit values
--  in the Supabase table editor or via the UI)
-- ============================================================
insert into forecast.occupancy (forecast_date, hotel_id, occupancy_pct, rooms_sold, adr, revpar, breakfast_covers)
select
  (current_date + s.i)::date,
  h.id,
  null, null, null, null, null
from generate_series(0, 29) as s(i)
cross join hotels h
on conflict (forecast_date, hotel_id) do nothing;

-- ============================================================
-- VERIFY
-- ============================================================
-- Run this to confirm everything is set up:
--
-- select count(*) from forecast.occupancy;
-- select count(*) from forecast.fb_covers;
-- select count(*) from forecast.monthly_budget;
-- select count(*) from forecast.demand_events;
