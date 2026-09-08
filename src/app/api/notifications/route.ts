import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listNotifications, markAllRead, unreadCount } from "@/lib/notifications";

/** FR-021: in-app notifications for the signed-in user. */
export const GET = handle(async () => {
  const user = await requireUser();
  return ok({ notifications: listNotifications(user.id), unread: unreadCount(user.id) });
});

export const POST = handle(async () => {
  const user = await requireUser();
  markAllRead(user.id);
  return ok({ unread: 0 });
});
