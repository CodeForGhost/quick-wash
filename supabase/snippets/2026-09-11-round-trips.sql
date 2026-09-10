-- Cutting the round trips out of a request (performance, 2026-09-11).
--
-- Paste this into Supabase -> SQL Editor. It is incremental and safe to
-- re-run: it drops and recreates functions, and touches no data. The same
-- objects are in schema.sql, so a fresh project needs only that.
--
-- Every call from the app is an HTTPS round trip to this project, ~100ms
-- warm. The app was making eight of them to move one order forward. This
-- file removes five:
--
--   * custom_access_token_hook  - the role rides in the JWT, so a request no
--                                 longer reads `users` to find out who is
--                                 asking (needs the dashboard step below);
--   * order_details             - the four write functions now return the
--                                 order they just wrote, so nothing reads it
--                                 back afterwards;
--   * notify_order              - works out its own recipients instead of
--                                 being handed a list the app queried for;
--   * the two count views       - a dashboard counts in Postgres instead of
--                                 dragging every order over the wire.


-- ============================================================================
-- 1. The role in the access token
-- ============================================================================
-- getSessionUser() used to cost two round trips: one to the Auth API to check
-- the token, one to `users` for the role. The first is gone on the app side -
-- getClaims() verifies the ES256 signature locally. This removes the second
-- by putting what the app needs in the token itself.
--
-- REQUIRES A DASHBOARD STEP: Authentication -> Hooks -> Customize Access
-- Token (JWT) Claims -> select public.custom_access_token_hook. Without it
-- the hook never runs and src/lib/auth.ts falls back to the query, so the app
-- keeps working - just at the old cost.
--
-- The claims are baked in when the token is issued, so a role change reaches
-- an open session only when the token next refreshes. updateUser() in
-- src/lib/repos.ts therefore ends the sessions of anyone whose role, shop or
-- active flag changed, exactly as it already did for a deactivation.
-- Authorization does not rest on this either way: RLS reads `users` through
-- my_role(), which is always current.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  app    jsonb := coalesce(claims -> 'app_metadata', '{}'::jsonb);
  u      record;
begin
  select id, name, phone, email, role, shop_id, is_active
    into u
    from public.users
   where auth_id = (event ->> 'user_id')::uuid;

  -- No row yet (the signup trigger runs in the same transaction as the first
  -- token) - leave the claims alone and let the app fall back to the query.
  if not found then
    return event;
  end if;

  app := app || jsonb_build_object(
    'user_id',   u.id,
    'name',      u.name,
    'phone',     u.phone,
    'email',     u.email,
    'user_role', u.role,      -- not 'role': that is Postgres's own claim
    'shop_id',   u.shop_id,
    'is_active', u.is_active
  );

  return jsonb_set(event, '{claims,app_metadata}', app);
end;
$$;

-- The hook runs as supabase_auth_admin, which is outside RLS and has to be
-- told it may read the table at all.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table public.users to supabase_auth_admin;

drop policy if exists "the token hook reads users" on public.users;
create policy "the token hook reads users" on public.users
  as permissive for select to supabase_auth_admin using (true);


-- ============================================================================
-- 2. The write functions return what they wrote
-- ============================================================================
-- Each of these returned an id, and src/lib/orders.ts immediately read the
-- order back to get the joined shape every screen wants - a second round trip
-- per write, and a third in assignPickupAgent, which writes twice. Returning
-- the row is the same query, on the server, inside the transaction that just
-- wrote it.

/**
 * One order in the shape OrderWithDetails describes, or null when the caller
 * may not see it. Security definer to read past RLS on the joined tables,
 * gated on can_view_order() - which is what the RLS on those tables allows
 * anyway: you may read anyone named on an order you can already see.
 */
create or replace function public.order_details(p_order_id bigint)
returns json
language sql stable security definer set search_path = public
as $$
  select to_json(d) from (
    select o.*,
           coalesce(c.name, '')    as customer_name,
           coalesce(c.phone, '')   as customer_phone,
           pa.name                 as pickup_agent_name,
           pa.phone                as pickup_agent_phone,
           da.name                 as delivery_agent_name,
           s.name                  as shop_name,
           coalesce(a.label, '')   as address_label,
           coalesce(a.address, '') as address_line,
           a.area                  as address_area,
           a.landmark              as address_landmark,
           a.phone                 as address_phone
      from public.laundry_orders o
      left join public.users         c  on c.id  = o.customer_id
      left join public.users         pa on pa.id = o.pickup_agent_id
      left join public.users         da on da.id = o.delivery_agent_id
      left join public.laundry_shops s  on s.id  = o.laundry_shop_id
      left join public.addresses     a  on a.id  = o.pickup_address_id
     where o.id = p_order_id
       and public.can_view_order(p_order_id)
  ) d;
$$;

-- Postgres cannot change a function's return type in place.
drop function if exists public.create_order(bigint, date, text, integer, integer, text, bigint);
drop function if exists public.transition_order(bigint, text, text, integer);
drop function if exists public.set_order_price(bigint, numeric);
drop function if exists public.assign_agent(bigint, bigint, boolean);

/**
 * FR-005 / FR-006: a PENDING order plus its first history row (BR-007), and
 * the order number, in one transaction.
 */
create or replace function public.create_order(
  p_address_id       bigint,
  p_pickup_date      date,
  p_pickup_time_slot text,
  p_bag_count        integer,
  p_item_count       integer default null,
  p_notes            text default null,
  p_customer_id      bigint default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  actor    bigint := public.me();
  customer bigint := coalesce(p_customer_id, public.me());
  shop     bigint;
  new_id   bigint;
begin
  if actor is null then raise exception 'NOT_SIGNED_IN'; end if;
  -- Only an administrator may raise an order on someone else's behalf.
  if customer <> actor and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_bag_count < 1 then raise exception 'BAD_BAG_COUNT'; end if;

  -- BR-001: the pickup address must exist and belong to the customer.
  if not exists (
    select 1 from public.addresses
     where id = p_address_id and user_id = customer and not is_deleted
  ) then
    raise exception 'BAD_ADDRESS';
  end if;

  -- For the MVP a single active shop receives every order (FR-026).
  select id into shop from public.laundry_shops where is_active order by id limit 1;

  insert into public.laundry_orders
    (order_number, customer_id, laundry_shop_id, status, pickup_address_id,
     pickup_date, pickup_time_slot, bag_count, item_count, notes)
  values
    (public.next_order_number(), customer, shop, 'PENDING', p_address_id,
     p_pickup_date, p_pickup_time_slot, p_bag_count, p_item_count, p_notes)
  returning id into new_id;

  insert into public.order_status_history (order_id, status, changed_by, notes)
  values (new_id, 'PENDING', actor, 'Pickup requested');

  return public.order_details(new_id);
end;
$$;

/**
 * BR-004, BR-005, BR-006, BR-007, BR-009: the status change and its history
 * row, together. src/lib/orders.ts checks the same rules to shape the UI;
 * these are the ones that actually hold.
 */
create or replace function public.transition_order(
  p_order_id    bigint,
  p_to          text,
  p_notes       text default null,
  p_actual_bags integer default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  actor bigint := public.me();
  who   text   := public.my_role();
  o     record;
  stamp text;
begin
  if actor is null then raise exception 'NOT_SIGNED_IN'; end if;

  select * into o from public.laundry_orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if not public.can_view_order(p_order_id) then raise exception 'FORBIDDEN'; end if;
  if not public.role_may_set(who, p_to) then raise exception 'FORBIDDEN'; end if;

  -- BR-009: a completed order can only be touched by an administrator.
  if o.status = 'DELIVERED' and who <> 'ADMIN' then raise exception 'ALREADY_DONE'; end if;

  -- BR-004: an agent may only update orders assigned to them.
  if who = 'PICKUP_AGENT' then
    if p_to = 'DELIVERED' then
      if o.delivery_agent_id is distinct from actor then raise exception 'FORBIDDEN'; end if;
    elsif o.pickup_agent_id is distinct from actor then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  if o.status = p_to then return public.order_details(p_order_id); end if;
  if not public.allowed_transition(o.status, p_to) then raise exception 'BAD_TRANSITION'; end if;

  stamp := case p_to
             when 'PICKED_UP' then 'picked_up_at'
             when 'AT_LAUNDRY' then 'received_at'
             when 'READY' then 'ready_at'
             when 'DELIVERED' then 'delivered_at'
             when 'CANCELLED' then 'cancelled_at'
           end;

  update public.laundry_orders
     set status           = p_to,
         actual_bag_count = coalesce(p_actual_bags, actual_bag_count),
         updated_at       = now(),
         picked_up_at = case when stamp = 'picked_up_at' then now() else picked_up_at end,
         received_at  = case when stamp = 'received_at'  then now() else received_at  end,
         ready_at     = case when stamp = 'ready_at'     then now() else ready_at     end,
         delivered_at = case when stamp = 'delivered_at' then now() else delivered_at end,
         cancelled_at = case when stamp = 'cancelled_at' then now() else cancelled_at end
   where id = p_order_id;

  insert into public.order_status_history (order_id, status, changed_by, notes)
  values (p_order_id, p_to, actor, coalesce(p_notes, p_to));

  return public.order_details(p_order_id);
end;
$$;

/** FR-014 / BR-010: the price and its history row together. */
create or replace function public.set_order_price(p_order_id bigint, p_price numeric)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  actor bigint := public.me();
  who   text   := public.my_role();
  o     record;
begin
  if actor is null then raise exception 'NOT_SIGNED_IN'; end if;
  if who not in ('SHOP_STAFF','ADMIN') then raise exception 'FORBIDDEN'; end if;
  if p_price < 0 then raise exception 'BAD_PRICE'; end if;

  select * into o from public.laundry_orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not public.can_view_order(p_order_id) then raise exception 'FORBIDDEN'; end if;
  if o.status = 'DELIVERED' and who <> 'ADMIN' then raise exception 'ALREADY_DONE'; end if;

  update public.laundry_orders set price = p_price, updated_at = now() where id = p_order_id;
  insert into public.order_status_history (order_id, status, changed_by, notes)
  values (p_order_id, o.status, actor,
          'Price set to LKR ' || trim(to_char(p_price, 'FM999,999,990.00')));

  return public.order_details(p_order_id);
end;
$$;

/** FR-007 / FR-016 (BR-003): only an administrator assigns agents. */
create or replace function public.assign_agent(
  p_order_id bigint,
  p_agent_id bigint,
  p_delivery boolean default false
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  current_status text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (
    select 1 from public.users
     where id = p_agent_id and role = 'PICKUP_AGENT' and is_active
  ) then
    raise exception 'AGENT_UNAVAILABLE';
  end if;

  -- The stage check lives here rather than in the caller so that reading the
  -- status and writing the agent cannot be two separate round trips, and
  -- cannot interleave with someone else moving the order on.
  select status into current_status
    from public.laundry_orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if p_delivery then
    if current_status not in ('READY','OUT_FOR_DELIVERY') then
      raise exception 'BAD_STAGE_DELIVERY';
    end if;
  else
    if current_status not in ('PENDING','PICKUP_ASSIGNED') then
      raise exception 'BAD_STAGE_PICKUP';
    end if;
  end if;

  if p_delivery then
    update public.laundry_orders
       set delivery_agent_id = p_agent_id, updated_at = now()
     where id = p_order_id;
  else
    update public.laundry_orders
       set pickup_agent_id = p_agent_id, updated_at = now()
     where id = p_order_id;
  end if;

  return public.order_details(p_order_id);
end;
$$;


-- ============================================================================
-- 3. Notifications work out their own recipients
-- ============================================================================
-- notify() used to ask `users` who the shop staff are and then hand the list
-- to notify_users() - two round trips for one notification. The recipient
-- matrix (SRS section 19) still lives in src/lib/notification-events.ts,
-- which is where the wording is; only the "which ids is that" half moves
-- here, where the rows already are.
--
-- notify_users() stays: the seeder still calls it with an explicit list.

create or replace function public.notify_order(
  p_order_id   bigint,
  p_audiences  text[],
  p_event      text,
  p_title      text,
  p_body       text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if public.me() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from public.laundry_orders where id = p_order_id) then
    raise exception 'NOT_FOUND';
  end if;

  insert into public.notifications (user_id, order_id, event, title, body)
  select r.id, p_order_id, p_event, p_title, p_body from (
    select o.customer_id as id from public.laundry_orders o
     where o.id = p_order_id and 'customer' = any (p_audiences)
    union
    select o.pickup_agent_id from public.laundry_orders o
     where o.id = p_order_id and 'pickup_agent' = any (p_audiences)
    union
    select o.delivery_agent_id from public.laundry_orders o
     where o.id = p_order_id and 'delivery_agent' = any (p_audiences)
    union
    -- Shop notifications go to every active staff member of the assigned shop;
    -- an order not yet routed to one goes to all of them.
    select u.id from public.users u, public.laundry_orders o
     where o.id = p_order_id and 'shop' = any (p_audiences)
       and u.role = 'SHOP_STAFF'
       and u.is_active
       and (o.laundry_shop_id is null or u.shop_id = o.laundry_shop_id)
  ) r
  where r.id is not null;
end;
$$;


-- ============================================================================
-- 4. Counting happens in Postgres
-- ============================================================================
-- statusCounts() selected every order's status column and counted the rows in
-- JavaScript - the whole table over the wire, on a dashboard that asks twice.
-- PostgREST has no GROUP BY, so as with agent_workload and customer_summary
-- the answer is a view. security_invoker keeps RLS applying through them, so
-- shop staff still count only their own shop's orders.

/** FR-023: the whole board, one row per status. */
create or replace view order_status_counts
with (security_invoker = on) as
  select status, count(*)::integer as total
    from public.laundry_orders
   group by status;

/** The same, for the "today" panel: one row per status per pickup date. */
create or replace view order_status_counts_by_date
with (security_invoker = on) as
  select pickup_date, status, count(*)::integer as total
    from public.laundry_orders
   group by pickup_date, status;
