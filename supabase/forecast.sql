-- ============================================================
-- HOTEL OPS — FORECAST TABLES  (idempotent — safe to re-run)
-- Run this in Supabase SQL Editor (Settings → SQL Editor)
--
-- Tables are in the public schema — no extra configuration needed.
-- ============================================================

-- ============================================================
-- forecast_occupancy
-- Daily occupancy forecast per hotel
-- ============================================================
create table if not exists forecast_occupancy (
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

alter table forecast_occupancy add column if not exists rooms_sold       int;
alter table forecast_occupancy add column if not exists adr              numeric(10,2);
alter table forecast_occupancy add column if not exists revpar           numeric(10,2);
alter table forecast_occupancy add column if not exists updated_at       timestamptz default now();
alter table forecast_occupancy add column if not exists arrivals         int;
alter table forecast_occupancy add column if not exists departures       int;

-- ============================================================
-- forecast_fb_covers
-- F&B covers & revenue forecast by outlet and day
-- ============================================================
create table if not exists forecast_fb_covers (
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
-- forecast_monthly_budget
-- Monthly budget / revenue targets per hotel
-- ============================================================
create table if not exists forecast_monthly_budget (
  id                 serial primary key,
  budget_month       date        not null,  -- first day of month
  hotel_id           text        not null references hotels(id),
  rooms_revenue      numeric(12,2),
  rooms_sold         int,
  occupancy_target   numeric(5,2),
  adr_target         numeric(10,2),
  fb_revenue         numeric(12,2),
  breakfast_covers   int,
  restaurant_covers  int,
  banqueting_covers  int,
  payroll_budget     numeric(12,2),
  supplies_budget    numeric(12,2),
  total_revenue      numeric(12,2),
  notes              text,
  created_at         timestamptz default now(),
  unique(budget_month, hotel_id)
);

-- ============================================================
-- forecast_demand_events
-- External events that drive demand (fairs, concerts, trade shows…)
-- ============================================================
create table if not exists forecast_demand_events (
  id             serial primary key,
  event_date     date not null,
  event_end_date date,
  hotel_id       text,           -- null = affects both hotels
  event_name     text not null,
  impact_level   text check (impact_level in ('low','medium','high','peak')),
  expected_rooms int,
  notes          text,
  created_at     timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table forecast_occupancy      enable row level security;
alter table forecast_fb_covers      enable row level security;
alter table forecast_monthly_budget enable row level security;
alter table forecast_demand_events  enable row level security;

do $$ begin
  drop policy if exists "forecast_occupancy_read"       on forecast_occupancy;
  drop policy if exists "forecast_occupancy_write"      on forecast_occupancy;
  drop policy if exists "forecast_fb_covers_read"       on forecast_fb_covers;
  drop policy if exists "forecast_fb_covers_write"      on forecast_fb_covers;
  drop policy if exists "forecast_monthly_budget_read"  on forecast_monthly_budget;
  drop policy if exists "forecast_monthly_budget_write" on forecast_monthly_budget;
  drop policy if exists "forecast_demand_events_read"   on forecast_demand_events;
  drop policy if exists "forecast_demand_events_write"  on forecast_demand_events;
end $$;

create policy "forecast_occupancy_read"
  on forecast_occupancy for select using (auth.role() = 'authenticated');
create policy "forecast_occupancy_write"
  on forecast_occupancy for all using (get_my_role() in ('admin','manager'));

create policy "forecast_fb_covers_read"
  on forecast_fb_covers for select using (auth.role() = 'authenticated');
create policy "forecast_fb_covers_write"
  on forecast_fb_covers for all using (get_my_role() in ('admin','manager'));

create policy "forecast_monthly_budget_read"
  on forecast_monthly_budget for select using (auth.role() = 'authenticated');
create policy "forecast_monthly_budget_write"
  on forecast_monthly_budget for all using (get_my_role() in ('admin','manager'));

create policy "forecast_demand_events_read"
  on forecast_demand_events for select using (auth.role() = 'authenticated');
create policy "forecast_demand_events_write"
  on forecast_demand_events for all using (get_my_role() in ('admin','manager'));

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
create or replace function set_forecast_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on forecast_occupancy;
create trigger set_updated_at
  before update on forecast_occupancy
  for each row execute function set_forecast_updated_at();

-- ============================================================
-- SEED: next 30 days of blank occupancy rows
-- ============================================================
insert into forecast_occupancy (forecast_date, hotel_id)
select
  (current_date + s.i)::date,
  h.id
from generate_series(0, 29) as s(i)
cross join hotels h
on conflict (forecast_date, hotel_id) do nothing;

-- ============================================================
-- VERIFY — paste these into a new SQL query to confirm:
--   select count(*) from forecast_occupancy;       -- should be >= 60
--   select count(*) from forecast_fb_covers;
--   select count(*) from forecast_monthly_budget;
--   select count(*) from forecast_demand_events;
-- ============================================================
