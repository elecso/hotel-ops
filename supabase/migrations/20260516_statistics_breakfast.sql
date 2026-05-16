-- ============================================================
-- Migration: add adr to daily_stats, budget table,
--            hotel_all_stars table, breakfast product type,
--            category column on recipes
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add ADR column to daily_stats (rps already exists)
ALTER TABLE daily_stats
  ADD COLUMN IF NOT EXISTS adr numeric(10,2);

-- 2. Add 'breakfast' to product type enums
-- Uses DO block to find actual constraint names (auto-generated names vary)
DO $$
DECLARE
  v_constraint text;
BEGIN
  -- products.type
  SELECT conname INTO v_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'products' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%type%in%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE products DROP CONSTRAINT ' || quote_ident(v_constraint);
  END IF;

  -- product_categories.type
  SELECT conname INTO v_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'product_categories' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%type%in%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE product_categories DROP CONSTRAINT ' || quote_ident(v_constraint);
  END IF;
END $$;

ALTER TABLE products ADD CONSTRAINT products_type_check
  CHECK (type IN ('room','beverage','food','cleaning_fb','cleaning_general','meeting','laundry','ingredient','breakfast'));

ALTER TABLE product_categories ADD CONSTRAINT product_categories_type_check
  CHECK (type IN ('room','beverage','food','cleaning_fb','cleaning_general','meeting','laundry','ingredient','breakfast'));

-- 3. Add 'category' column to recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS category text
  CHECK (category IN ('food','beverage'));

-- 4. Create budget table
CREATE TABLE IF NOT EXISTS budget (
  id               bigserial primary key,
  hotel_id         text not null references hotels(id),
  month            date not null,
  occupancy_budget numeric(5,2),
  adr_budget       numeric(10,2),
  unique(hotel_id, month)
);

ALTER TABLE budget ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read" ON budget;
CREATE POLICY "authenticated_read" ON budget FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "manager_budget" ON budget;
CREATE POLICY "manager_budget" ON budget FOR ALL USING (get_my_role() IN ('admin','manager'));

-- 5. Create hotel_all_stars table
CREATE TABLE IF NOT EXISTS hotel_all_stars (
  id             bigserial primary key,
  hotel_id       text not null references hotels(id),
  month          date not null,
  all_stars_mtd  numeric(5,1),
  all_stars_ytd  numeric(5,1),
  unique(hotel_id, month)
);

ALTER TABLE hotel_all_stars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read" ON hotel_all_stars;
CREATE POLICY "authenticated_read" ON hotel_all_stars FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "manager_all_stars" ON hotel_all_stars;
CREATE POLICY "manager_all_stars" ON hotel_all_stars FOR ALL USING (get_my_role() IN ('admin','manager'));
