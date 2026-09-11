import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { removeSubscription, saveSubscription } from "@/lib/push";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validation";

/**
 * FR-018: a device asks to be told when this person's orders move. The
 * subscription is stored against whoever is signed in - nobody can register
 * a device for somebody else - and only customers are notified today, so
 * only customers may register.
 */
export const POST = handle(async (request: Request) => {
  const user = await requireUser("CUSTOMER");
  const subscription = pushSubscriptionSchema.parse(await readJson(request));
  await saveSubscription(user.id, subscription, request.headers.get("user-agent"));
  return ok({ subscribed: true });
});

/** The device no longer wants to hear from us. */
export const DELETE = handle(async (request: Request) => {
  const user = await requireUser("CUSTOMER");
  const { endpoint } = pushUnsubscribeSchema.parse(await readJson(request));
  await removeSubscription(user.id, endpoint);
  return ok({ subscribed: false });
});
