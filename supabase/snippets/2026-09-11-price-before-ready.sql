-- The price comes before READY (FR-014 before FR-015, 2026-09-11).
--
-- Paste this into Supabase -> SQL Editor. It is incremental and safe to
-- re-run: it recreates one function and touches no data. The same object is
-- in schema.sql, so a fresh project needs only that.
--
-- Marking an order READY sends the customer a "your laundry is ready"
-- notification, and the ready screen is where they read what they owe. The
-- shop could previously press "Mark ready" with the price still empty, and
-- the customer then saw a ready order with no amount. transition_order() now
-- refuses READY while `price` is null, raising PRICE_REQUIRED. The shop
-- screen disables the button for the same reason, but this is the copy that
-- holds: the anon key ships to the browser.
--
-- Orders already at READY or later with no price are left alone - nothing
-- here moves them, and set_order_price() still accepts a price for them.

create or replace function public.transition_order(
  p_order_id  bigint,
  p_to        text,
  p_notes     text default null,
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

  -- FR-014 before FR-015: READY tells the customer what they owe, so the
  -- shop must have priced the order before it can say so.
  if p_to = 'READY' and o.price is null then raise exception 'PRICE_REQUIRED'; end if;

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
