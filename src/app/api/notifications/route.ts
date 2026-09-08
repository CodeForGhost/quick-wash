import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listNotifications, markAllRead, unreadCount } from "@/lib/notifications";

/** FR-021: in-app notifications for the signed-in user. */
export const GET = handle(async () => {
  const user = await requireUser();
  return ok({ notifications: await listNotifications(user.id), unread: await unreadCount(user.id) });
});

export const POST = handle(async () => {
  const user = await requireUser();
  await markAllRead(user.id);
  return ok({ unread: 0 });
});
