-- Live order status for customers (FR-018, 2026-09-11).
--
-- Paste this into Supabase -> SQL Editor. It is incremental and safe to
-- re-run, and touches no data. The same block is at the end of schema.sql,
-- so a fresh project needs only that.
--
-- The customer's order pages now subscribe over Supabase Realtime to changes
-- on laundry_orders and re-render when one arrives. Realtime only streams the
-- tables in the supabase_realtime publication, and this adds the one table
-- it needs. Who receives a given change is still decided by the "orders
-- follow BR-008" row level security policy, so nothing else changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'laundry_orders'
  ) then
    alter publication supabase_realtime add table public.laundry_orders;
  end if;
end $$;
