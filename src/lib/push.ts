import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "./supabase/admin";

/**
 * FR-018: Web Push - the notification that reaches a phone with the site
 * closed. The browser hands us a subscription (an endpoint at Google's,
 * Apple's or Mozilla's push service plus two keys); we keep it against the
 * user and, when their order moves, sign a message with our VAPID key and
 * post it to that endpoint. The push service wakes the phone, and
 * public/sw.js shows it.
 *
 * Reads and writes go through the service role: an admin moving an order
 * needs the customer's subscriptions, which row level security would never
 * hand to anyone but the customer. The route that saves a subscription has
 * already authenticated the caller, and the user id it stores is that
 * caller's own.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Same tag, same order: a newer notification replaces the one showing. */
  tag: string;
  /** Where a tap lands. */
  url: string;
}

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface SubscriptionRow {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured: boolean | undefined;

/**
 * Push is optional: without the three env values the app runs exactly as
 * before and sends nothing. Checked once, so a missing key is one warning in
 * the log rather than one per order.
 */
function ready(): boolean {
  if (configured !== undefined) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.warn("[push] VAPID keys are not set; push notifications are off (see .env.example).");
    configured = false;
  } else {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return configured;
}

/** One device may switch accounts: the endpoint follows whoever last subscribed on it. */
export async function saveSubscription(
  userId: number,
  subscription: BrowserSubscription,
  userAgent: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent,
      },
      { onConflict: "endpoint" },
    );
  if (error) throw error;
}

export async function removeSubscription(userId: number, endpoint: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
  if (error) throw error;
}

/**
 * Sends one payload to every device the given users have subscribed. Never
 * throws: a push is a courtesy on top of the in-app notification, and a
 * status change must not fail because a phone was unreachable. A
 * subscription the push service reports gone (404/410) is deleted so it is
 * not tried again.
 */
export async function pushToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0 || !ready()) return;

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", userIds);
    if (error) throw error;
    const rows = (data ?? []) as SubscriptionRow[];
    if (rows.length === 0) return;

    const body = JSON.stringify(payload);
    const gone: number[] = [];

    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            body,
            { TTL: 60 * 60 * 24, urgency: "high" },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(row.id);
          else console.error("[push] send failed for user", row.user_id, error);
        }
      }),
    );

    if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  } catch (error) {
    console.error("[push]", error);
  }
}
