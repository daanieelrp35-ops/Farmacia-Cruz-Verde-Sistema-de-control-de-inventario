-- Run this once in Supabase Dashboard > SQL Editor.
-- All inventory operations require a signed-in Supabase user (RLS enabled).
create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  code text not null default '',
  deposit integer not null default 0 check (deposit >= 0),
  local integer not null default 0 check (local >= 0),
  created_at timestamptz not null default now()
);

alter table public.inventory_products enable row level security;

drop policy if exists "Authenticated users can read inventory" on public.inventory_products;
create policy "Authenticated users can read inventory"
  on public.inventory_products for select to authenticated using (true);

drop policy if exists "Authenticated users can add inventory" on public.inventory_products;
create policy "Authenticated users can add inventory"
  on public.inventory_products for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update inventory" on public.inventory_products;
create policy "Authenticated users can update inventory"
  on public.inventory_products for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete inventory" on public.inventory_products;
create policy "Authenticated users can delete inventory"
  on public.inventory_products for delete to authenticated using (true);

-- Enable live updates for clients that are subscribed to this table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_products'
  ) then
    alter publication supabase_realtime add table public.inventory_products;
  end if;
end
$$;
