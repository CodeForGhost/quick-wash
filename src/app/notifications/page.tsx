import Link from "next/link";
import { redirect } from "next/navigation";
import { HOME } from "@/components/app-shell";
import { WashMark } from "@/components/nav";
import { Card, EmptyState, PageTitle } from "@/components/patterns";
import { getSessionUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { listNotifications } from "@/lib/notifications";
import { MarkAllRead } from "./mark-all-read";

export const metadata = { title: "Updates · QuickWash" };

/** FR-021: in-app notifications, shared by every role. */
export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notifications = await listNotifications(user.id, 60);
  const unread = notifications.filter((item) => !item.is_read).length;
  const orderPath = user.role === "CUSTOMER" ? "/customer/orders/" : "/admin/orders/";

  return (
    <div className="min-h-svh">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href={HOME[user.role]} className="flex items-center gap-2.5">
            <WashMark />
            <span className="font-display text-sm font-bold tracking-tighter text-ink">QuickWash</span>
          </Link>
          <Link href={HOME[user.role]} className="ml-auto text-sm font-semibold text-lagoon">
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageTitle
            eyebrow="FR-021"
            title="Updates"
            subtitle={unread > 0 ? `${unread} you have not read yet.` : "You are up to date."}
          />
          {unread > 0 ? <MarkAllRead /> : null}
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            body="You will hear from us when an order is assigned, collected, washed, or delivered."
          />
        ) : (
          <Card className="divide-y divide-hairline overflow-hidden">
            {notifications.map((item) => {
              const body = (
                <>
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={
                        item.is_read
                          ? "mt-2 size-2 shrink-0 rounded-full bg-transparent"
                          : "mt-2 size-2 shrink-0 rounded-full bg-lagoon"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-sm text-ink-soft">{item.body}</p>
                      <p className="mt-1 text-xs text-ink-faint">{formatDateTime(item.created_at)}</p>
                    </div>
                  </div>
                </>
              );

              return item.order_id ? (
                <Link
                  key={item.id}
                  href={orderPath + item.order_id}
                  className="block p-4 transition hover:bg-ground/40"
                >
                  {body}
                </Link>
              ) : (
                <div key={item.id} className="p-4">
                  {body}
                </div>
              );
            })}
          </Card>
        )}
      </main>
    </div>
  );
}
