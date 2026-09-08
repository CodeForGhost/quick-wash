import type { OrderStatus } from "./types";

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return "LKR " + value.toLocaleString("en-LK", { maximumFractionDigits: 2 });
}

/**
 * Postgres hands back two shapes and they must not be parsed the same way:
 * a `date` column arrives as `2026-09-03`, a `timestamptz` as a full ISO
 * instant with an offset already on it. Appending a `Z` to the second makes an
 * invalid date, so the two shapes are told apart rather than patched.
 */
function parse(value: string): Date {
  // A bare calendar day is local midnight, not UTC midnight: `pickup_date` is
  // the day the agent knocks on the door, in the town's own timezone.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : new Date(value);
}

/** `2026-09-03` -> `03 Sep 2026`. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = parse(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Timestamps are stored in UTC; render them in the viewer's timezone. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = parse(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = parse(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function relativeDay(date: string): string {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000 - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  if (date === today) return "Today";
  if (date === tomorrow) return "Tomorrow";
  return formatDate(date);
}

/** Tailwind classes for the status pill, grouped by pipeline stage. */
export const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-600/20",
  PICKUP_ASSIGNED: "bg-blue-100 text-blue-800 ring-blue-600/20",
  PICKED_UP: "bg-blue-100 text-blue-800 ring-blue-600/20",
  AT_LAUNDRY: "bg-violet-100 text-violet-800 ring-violet-600/20",
  WASHING: "bg-violet-100 text-violet-800 ring-violet-600/20",
  DRYING: "bg-violet-100 text-violet-800 ring-violet-600/20",
  IRONING: "bg-violet-100 text-violet-800 ring-violet-600/20",
  READY: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  OUT_FOR_DELIVERY: "bg-teal-100 text-teal-800 ring-teal-600/20",
  DELIVERED: "bg-slate-200 text-slate-700 ring-slate-500/20",
  CANCELLED: "bg-rose-100 text-rose-800 ring-rose-600/20",
};

/** Today as `YYYY-MM-DD`, in the server's local timezone. */
export function today(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}
