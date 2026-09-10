import "server-only";
import { supabaseServer } from "./supabase/server";
import { EVENTS, type NotificationEvent } from "./notification-events";
import type { LaundryOrder, Notification } from "./types";

export type { NotificationEvent } from "./notification-events";

/**
 * Records in-app notifications for an event. For the MVP these are stored and
 * shown in the app; a WhatsApp/SMS provider can be plugged in here later.
 *
 * The insert goes through notify_order() because row level security lets you
 * read only your own notifications - you could never insert someone else's,
 * which is exactly what a notification is. That function also works out who
 * the audiences name: a shop event used to cost a query here for the shop's
 * staff and then a second call to write the rows, and the ids were already
 * sitting next to the insert.
 */
export async function notify(event: NotificationEvent, order: LaundryOrder): Promise<void> {
  const spec = EVENTS[event];
  if (!spec) return;

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("notify_order", {
    p_order_id: order.id,
    p_audiences: spec.to,
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
