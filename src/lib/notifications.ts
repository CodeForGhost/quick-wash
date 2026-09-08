import "server-only";
import { supabaseServer } from "./supabase/server";
import { EVENTS, type Audience, type NotificationEvent } from "./notification-events";
import type { LaundryOrder, Notification } from "./types";

export type { NotificationEvent } from "./notification-events";

async function recipients(order: LaundryOrder, audiences: Audience[]): Promise<number[]> {
  const supabase = await supabaseServer();
  const ids = new Set<number>();

  for (const audience of audiences) {
    if (audience === "customer") ids.add(order.customer_id);
    if (audience === "pickup_agent" && order.pickup_agent_id) ids.add(order.pickup_agent_id);
    if (audience === "delivery_agent" && order.delivery_agent_id) ids.add(order.delivery_agent_id);
    if (audience === "shop") {
      // Shop notifications go to every active staff member of the assigned shop.
      let query = supabase.from("users").select("id").eq("role", "SHOP_STAFF").eq("is_active", true);
      if (order.laundry_shop_id) query = query.eq("shop_id", order.laundry_shop_id);
      const { data } = await query;
      for (const row of data ?? []) ids.add(row.id);
    }
  }
  return [...ids];
}

/**
 * Records in-app notifications for an event. For the MVP these are stored and
 * shown in the app; a WhatsApp/SMS provider can be plugged in here later.
 *
 * The insert goes through notify_users() because row level security lets you
 * read only your own notifications - you could never insert someone else's,
 * which is exactly what a notification is.
 */
export async function notify(event: NotificationEvent, order: LaundryOrder): Promise<void> {
  const spec = EVENTS[event];
  if (!spec) return;

  const userIds = await recipients(order, spec.to);
  if (!userIds.length) return;

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("notify_users", {
    p_user_ids: userIds,
    p_order_id: order.id,
    p_event: event,
    p_title: spec.title,
    p_body: spec.body(order),
  });
  if (error) throw error;
}

export async function listNotifications(userId: number, limit = 30): Promise<Notification[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function unreadCount(userId: number): Promise<number> {
  const supabase = await supabaseServer();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllRead(userId: number): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}
