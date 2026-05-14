-- ============================================================
-- HOTEL OPS — FULL SCHEMA
-- Run this in Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- HOTELS
-- ============================================================
create table if not exists hotels (
  id   text primary key,
  name text not null,
  brand text not null
);
insert into hotels values ('mercure','Mercure Lyon','mercure'),('ibis','Ibis Lyon','ibis')
  on conflict (id) do nothing;

-- ============================================================
-- ROOM TYPES
-- ============================================================
create table if not exists room_types (
  id       serial primary key,
  hotel_id text not null references hotels(id),
  code     text not null,
  label    text not null
);
insert into room_types (hotel_id, code, label) values
  ('mercure','SGL','Chambre 1 lit Double Classique'),
  ('mercure','TWCZ','Chambre 2 lits Simple Classique'),
  ('mercure','DBBZ','Chambre 1 lit Double Supérieur'),
  ('mercure','DBA','Chambre Privilège 1 lit double'),
  ('mercure','PRIVM','Chambre Privilège 1 lit double + canapé lit double'),
  ('ibis','DBL','Chambre DBL'),
  ('ibis','TWI','Chambre TWI'),
  ('ibis','HAN','Chambre HAN')
on conflict do nothing;

-- ============================================================
-- DAILY STATS
-- ============================================================
create table if not exists daily_stats (
  id               bigserial primary key,
  hotel_id         text not null references hotels(id),
  stat_date        date not null,
  occupancy_pct    numeric(5,2),
  arrivals         int,
  departures       int,
  breakfast_covers int,
  unique(hotel_id, stat_date)
);

-- ============================================================
-- F&B IMPORTS
-- ============================================================
create table if not exists fb_imports (
  id          bigserial primary key,
  import_date date not null,
  file_url    text,
  status      text check (status in ('pending','processing','validated','error')),
  created_by  uuid references auth.users(id)
);

-- ============================================================
-- F&B DAILY SALES
-- ============================================================
create table if not exists fb_daily_sales (
  id            bigserial primary key,
  sale_date     date not null,
  outlet        text not null check (outlet in ('breakfast_mercure','breakfast_ibis','lunch','dinner','room_service','banqueting_lunch','banqueting_dinner')),
  covers        int,
  revenue       numeric(10,2),
  raw_import_id bigint references fb_imports(id)
);

-- ============================================================
-- EVENTS
-- ============================================================
create table if not exists events (
  id         bigserial primary key,
  event_date date not null,
  event_name text not null,
  room       text,
  persons    int,
  type       text check (type in ('meeting','banqueting','event'))
);

-- ============================================================
-- FORECAST (schema-qualified)
-- See supabase/forecast.sql for the full forecast schema.
-- Run forecast.sql separately after this file.
-- ============================================================

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================
create table if not exists product_categories (
  id   serial primary key,
  name text not null,
  type text check (type in ('room','beverage','food','cleaning_fb','cleaning_general','meeting','laundry'))
);

-- ============================================================
-- SUPPLIERS
-- ============================================================
create table if not exists suppliers (
  id      serial primary key,
  name    text not null,
  contact text,
  url     text
);

-- ============================================================
-- PRODUCTS
-- ============================================================
create table if not exists products (
  id               serial primary key,
  name             text not null,
  sku              text,
  category_id      int references product_categories(id),
  supplier_id      int references suppliers(id),
  type             text check (type in ('room','beverage','food','cleaning_fb','cleaning_general','meeting','laundry')),
  unit             text,
  packaging_desc   text,
  packaging_qty    numeric,
  price_excl_tax   numeric(10,2),
  min_stock        numeric,
  delivery_days    int,
  purchase_url     text,
  hotel_scope      text check (hotel_scope in ('mercure','ibis','both')),
  is_active        boolean default true
);

-- ============================================================
-- PRODUCT ROOM TYPOLOGIES
-- ============================================================
create table if not exists product_room_typologies (
  product_id   int references products(id) on delete cascade,
  room_type_id int references room_types(id) on delete cascade,
  primary key (product_id, room_type_id)
);

-- ============================================================
-- BEVERAGE SUB-PRODUCTS
-- ============================================================
create table if not exists beverage_sub_products (
  id                serial primary key,
  parent_product_id int not null references products(id) on delete cascade,
  name              text not null,
  volume_cl         numeric,
  decrement_factor  numeric
);

-- ============================================================
-- STOCK MONTHS
-- ============================================================
create table if not exists stock_months (
  id                bigserial primary key,
  product_id        int not null references products(id),
  month             date not null,
  opening_stock     numeric default 0,
  bought            numeric default 0,
  used              numeric default 0,
  unique(product_id, month)
);
-- theoretical_stock is a computed view column handled at query level
-- (opening_stock + bought - used)

-- ============================================================
-- PRODUCT AI MAPPINGS
-- ============================================================
create table if not exists product_ai_mappings (
  id         serial primary key,
  raw_name   text unique not null,
  product_id int references products(id),
  mapped_by  uuid references auth.users(id),
  confirmed  boolean default false
);

-- ============================================================
-- REQUISITIONS
-- ============================================================
create table if not exists requisitions (
  id            bigserial primary key,
  requested_by  uuid references auth.users(id),
  request_date  date not null default current_date,
  status        text check (status in ('pending','validated','rejected')) default 'pending',
  type          text,
  notes         text
);

create table if not exists requisition_lines (
  id              bigserial primary key,
  requisition_id  bigint not null references requisitions(id) on delete cascade,
  product_id      int references products(id),
  qty_requested   numeric,
  qty_validated   numeric
);

-- ============================================================
-- INVOICES
-- ============================================================
create table if not exists invoices (
  id           bigserial primary key,
  uploaded_by  uuid references auth.users(id),
  upload_date  date not null default current_date,
  file_url     text,
  supplier_id  int references suppliers(id),
  status       text check (status in ('pending','ai_processed','validated')) default 'pending',
  total_amount numeric(10,2)
);

create table if not exists invoice_lines (
  id              bigserial primary key,
  invoice_id      bigint not null references invoices(id) on delete cascade,
  raw_description text,
  product_id      int references products(id),
  qty             numeric,
  unit_price      numeric(10,2),
  total           numeric(10,2),
  ai_confidence   numeric(5,2)
);

-- ============================================================
-- RECIPES
-- ============================================================
create table if not exists recipes (
  id             serial primary key,
  name           text not null,
  outlet         text,
  portion_size_g numeric,
  selling_price  numeric(10,2),
  is_active      boolean default true
);

create table if not exists recipe_ingredients (
  id         serial primary key,
  recipe_id  int not null references recipes(id) on delete cascade,
  product_id int references products(id),
  quantity   numeric,
  unit       text
);

create table if not exists menu_items (
  id        serial primary key,
  name      text not null,
  recipe_id int references recipes(id),
  price     numeric(10,2),
  outlet    text,
  is_active boolean default true
);

-- ============================================================
-- MENU ITEM SALES
-- ============================================================
create table if not exists menu_item_sales (
  id            bigserial primary key,
  sale_date     date not null,
  menu_item_id  int references menu_items(id),
  quantity      int,
  fb_import_id  bigint references fb_imports(id)
);

-- ============================================================
-- LOGBOOK
-- ============================================================
create table if not exists logbook_news (
  id           bigserial primary key,
  news_date    date not null,
  title        text not null,
  body         text,
  source       text,
  created_via  text default 'n8n'
);

create table if not exists morning_meeting (
  id           bigserial primary key,
  meeting_date date not null,
  notes        text,
  attendees    text[],
  created_via  text default 'n8n'
);

create table if not exists toilet_checks (
  id          bigserial primary key,
  check_date  date not null default current_date,
  toilet_id   int not null check (toilet_id in (1,2,3)),
  checked_by  text not null check (checked_by in ('Fadila','HK','other')),
  check_time  timestamptz default now(),
  validated   boolean default false,
  unique(check_date, toilet_id, checked_by)
);

-- ============================================================
-- DUTY ROSTER
-- ============================================================
create table if not exists staff (
  id          serial primary key,
  matricule   text unique not null,
  full_name   text not null,
  service     text,
  is_active   boolean default true
);

create table if not exists duty_roster (
  id          bigserial primary key,
  staff_id    int not null references staff(id),
  week_start  date not null,
  day_date    date not null,
  shift       text check (shift in ('morning','afternoon')),
  value       text,
  unique(staff_id, day_date, shift)
);

-- ============================================================
-- USER PROFILES
-- ============================================================
create table if not exists user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  role         text check (role in ('admin','manager','staff','readonly')) default 'readonly',
  hotel_access text check (hotel_access in ('mercure','ibis','both')) default 'both',
  created_at   timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table daily_stats         enable row level security;
alter table fb_imports          enable row level security;
alter table fb_daily_sales      enable row level security;
alter table events              enable row level security;
alter table product_categories  enable row level security;
alter table suppliers           enable row level security;
alter table products            enable row level security;
alter table product_room_typologies enable row level security;
alter table beverage_sub_products enable row level security;
alter table stock_months        enable row level security;
alter table product_ai_mappings enable row level security;
alter table requisitions        enable row level security;
alter table requisition_lines   enable row level security;
alter table invoices            enable row level security;
alter table invoice_lines       enable row level security;
alter table recipes             enable row level security;
alter table recipe_ingredients  enable row level security;
alter table menu_items          enable row level security;
alter table menu_item_sales     enable row level security;
alter table logbook_news        enable row level security;
alter table morning_meeting     enable row level security;
alter table toilet_checks       enable row level security;
alter table staff               enable row level security;
alter table duty_roster         enable row level security;
alter table user_profiles       enable row level security;
-- forecast.* RLS is handled in supabase/forecast.sql

-- Helper function to get current user role
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from user_profiles where id = auth.uid()
$$;

-- Helper function to get current user hotel access
create or replace function get_my_hotel_access()
returns text language sql security definer stable as $$
  select hotel_access from user_profiles where id = auth.uid()
$$;

-- Drop all existing policies first so this file is safe to re-run
do $$ begin
  -- read policies
  drop policy if exists "authenticated_read" on daily_stats;
  drop policy if exists "authenticated_read" on fb_imports;
  drop policy if exists "authenticated_read" on fb_daily_sales;
  drop policy if exists "authenticated_read" on events;
  drop policy if exists "authenticated_read" on product_categories;
  drop policy if exists "authenticated_read" on suppliers;
  drop policy if exists "authenticated_read" on products;
  drop policy if exists "authenticated_read" on product_room_typologies;
  drop policy if exists "authenticated_read" on beverage_sub_products;
  drop policy if exists "authenticated_read" on stock_months;
  drop policy if exists "authenticated_read" on product_ai_mappings;
  drop policy if exists "authenticated_read" on requisitions;
  drop policy if exists "authenticated_read" on requisition_lines;
  drop policy if exists "authenticated_read" on invoices;
  drop policy if exists "authenticated_read" on invoice_lines;
  drop policy if exists "authenticated_read" on recipes;
  drop policy if exists "authenticated_read" on recipe_ingredients;
  drop policy if exists "authenticated_read" on menu_items;
  drop policy if exists "authenticated_read" on menu_item_sales;
  drop policy if exists "authenticated_read" on logbook_news;
  drop policy if exists "authenticated_read" on morning_meeting;
  drop policy if exists "authenticated_read" on toilet_checks;
  drop policy if exists "authenticated_read" on staff;
  drop policy if exists "authenticated_read" on duty_roster;
  -- user profile
  drop policy if exists "own_profile_read" on user_profiles;
  -- write policies
  drop policy if exists "staff_write_fb_imports"    on fb_imports;
  drop policy if exists "staff_write_fb_sales"      on fb_daily_sales;
  drop policy if exists "staff_write_menu_sales"    on menu_item_sales;
  drop policy if exists "staff_write_requisitions"  on requisitions;
  drop policy if exists "staff_write_req_lines"     on requisition_lines;
  drop policy if exists "staff_write_invoices"      on invoices;
  drop policy if exists "staff_write_invoice_lines" on invoice_lines;
  drop policy if exists "staff_write_mappings"      on product_ai_mappings;
  drop policy if exists "staff_write_toilet"        on toilet_checks;
  drop policy if exists "staff_write_events"        on events;
  -- manager policies
  drop policy if exists "manager_update_req"        on requisitions;
  drop policy if exists "manager_update_req_lines"  on requisition_lines;
  drop policy if exists "manager_update_invoices"   on invoices;
  drop policy if exists "manager_update_inv_lines"  on invoice_lines;
  -- admin policies
  drop policy if exists "admin_stock_months"        on stock_months;
  drop policy if exists "admin_products"            on products;
  drop policy if exists "admin_categories"          on product_categories;
  drop policy if exists "admin_suppliers"           on suppliers;
  drop policy if exists "admin_recipes"             on recipes;
  drop policy if exists "admin_recipe_ing"          on recipe_ingredients;
  drop policy if exists "admin_menu_items"          on menu_items;
  drop policy if exists "admin_user_profiles"       on user_profiles;
  drop policy if exists "admin_staff"               on staff;
  drop policy if exists "admin_duty_roster"         on duty_roster;
  drop policy if exists "admin_bev_sub_products"    on beverage_sub_products;
  -- logbook
  drop policy if exists "logbook_news_write"        on logbook_news;
  drop policy if exists "morning_mtg_write"         on morning_meeting;
end $$;

-- READ policies — all authenticated users can read most tables
create policy "authenticated_read" on daily_stats        for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on fb_imports         for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on fb_daily_sales     for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on events             for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on product_categories for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on suppliers          for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on products           for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on product_room_typologies for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on beverage_sub_products for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on stock_months       for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on product_ai_mappings for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on requisitions       for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on requisition_lines  for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on invoices           for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on invoice_lines      for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on recipes            for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on recipe_ingredients for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on menu_items         for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on menu_item_sales    for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on logbook_news       for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on morning_meeting    for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on toilet_checks      for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on staff              for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on duty_roster        for select using (auth.role() = 'authenticated');
-- forecast.* read policy is in supabase/forecast.sql

-- user_profiles: users can read their own; admins can read all
create policy "own_profile_read" on user_profiles for select using (id = auth.uid() or get_my_role() = 'admin');

-- WRITE policies — staff and above can insert/update most operational tables
create policy "staff_write_fb_imports"    on fb_imports for insert with check (auth.role() = 'authenticated');
create policy "staff_write_fb_sales"      on fb_daily_sales for insert with check (auth.role() = 'authenticated');
create policy "staff_write_menu_sales"    on menu_item_sales for insert with check (auth.role() = 'authenticated');
create policy "staff_write_requisitions"  on requisitions for insert with check (auth.role() = 'authenticated');
create policy "staff_write_req_lines"     on requisition_lines for insert with check (auth.role() = 'authenticated');
create policy "staff_write_invoices"      on invoices for insert with check (auth.role() = 'authenticated');
create policy "staff_write_invoice_lines" on invoice_lines for insert with check (auth.role() = 'authenticated');
create policy "staff_write_mappings"      on product_ai_mappings for all using (auth.role() = 'authenticated');
create policy "staff_write_toilet"        on toilet_checks for all using (auth.role() = 'authenticated');
create policy "staff_write_events"        on events for all using (auth.role() = 'authenticated');

-- Manager+ can validate requisitions/invoices
create policy "manager_update_req"        on requisitions for update using (get_my_role() in ('admin','manager'));
create policy "manager_update_req_lines"  on requisition_lines for update using (get_my_role() in ('admin','manager'));
create policy "manager_update_invoices"   on invoices for update using (get_my_role() in ('admin','manager'));
create policy "manager_update_inv_lines"  on invoice_lines for update using (get_my_role() in ('admin','manager'));

-- Admin-only: stock_months write, products CRUD, user_profiles
create policy "admin_stock_months"        on stock_months for all using (get_my_role() = 'admin');
create policy "admin_products"            on products for all using (get_my_role() in ('admin','manager'));
create policy "admin_categories"          on product_categories for all using (get_my_role() in ('admin','manager'));
create policy "admin_suppliers"           on suppliers for all using (get_my_role() in ('admin','manager'));
create policy "admin_recipes"             on recipes for all using (get_my_role() in ('admin','manager'));
create policy "admin_recipe_ing"          on recipe_ingredients for all using (get_my_role() in ('admin','manager'));
create policy "admin_menu_items"          on menu_items for all using (get_my_role() in ('admin','manager'));
create policy "admin_user_profiles"       on user_profiles for all using (get_my_role() = 'admin');
create policy "admin_staff"               on staff for all using (get_my_role() in ('admin','manager'));
create policy "admin_duty_roster"         on duty_roster for all using (get_my_role() in ('admin','manager'));

-- Logbook: writable by service role (n8n webhook) — in production use service role bypass
create policy "logbook_news_write"        on logbook_news for insert with check (true);
create policy "morning_mtg_write"         on morning_meeting for insert with check (true);

-- ============================================================
-- TRIGGER: auto-create user_profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into user_profiles (id, full_name, role, hotel_access)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'readonly'),
    coalesce(new.raw_user_meta_data->>'hotel_access', 'both')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- MIGRATIONS — Safe to re-run
-- ============================================================

-- Add ingredient type to product_categories and products
alter table product_categories drop constraint if exists product_categories_type_check;
alter table product_categories add constraint product_categories_type_check
  check (type in ('room','beverage','food','cleaning_fb','cleaning_general','meeting','laundry','ingredient'));

alter table products drop constraint if exists products_type_check;
alter table products add constraint products_type_check
  check (type in ('room','beverage','food','cleaning_fb','cleaning_general','meeting','laundry','ingredient'));

-- Beverage sub-products write policy (admins and managers)
drop policy if exists "admin_bev_sub_products" on beverage_sub_products;
create policy "admin_bev_sub_products" on beverage_sub_products
  for all using (get_my_role() in ('admin','manager'));

-- Purchase orders tables
create table if not exists purchase_orders (
  id           bigserial primary key,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now(),
  status       text check (status in ('draft','ordered','received','cancelled')) default 'draft',
  supplier_id  int references suppliers(id),
  notes        text,
  type         text
);

create table if not exists purchase_order_lines (
  id                bigserial primary key,
  purchase_order_id bigint not null references purchase_orders(id) on delete cascade,
  product_id        int references products(id),
  qty_ordered       numeric,
  qty_received      numeric,
  unit_price        numeric(10,2)
);

alter table purchase_orders       enable row level security;
alter table purchase_order_lines  enable row level security;

drop policy if exists "auth_read_purchase_orders"        on purchase_orders;
drop policy if exists "auth_read_purchase_order_lines"   on purchase_order_lines;
drop policy if exists "admin_write_purchase_orders"      on purchase_orders;
drop policy if exists "admin_write_purchase_order_lines" on purchase_order_lines;

create policy "auth_read_purchase_orders"
  on purchase_orders for select using (auth.role() = 'authenticated');
create policy "auth_read_purchase_order_lines"
  on purchase_order_lines for select using (auth.role() = 'authenticated');
create policy "admin_write_purchase_orders"
  on purchase_orders for all using (get_my_role() in ('admin','manager'));
create policy "admin_write_purchase_order_lines"
  on purchase_order_lines for all using (get_my_role() in ('admin','manager'));
