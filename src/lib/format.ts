import type { OrderStatus } from "./types";

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return "LKR " + value.toLocaleString("en-LK", { maximumFractionDigits: 2 });
}

/**
 * The service runs in Puttalam, so every date and time on screen is that
 * town's, not the reader's and not the host's. Pinning the zone also keeps a
 * server render and its hydration in agreement - reading the ambient clock
 * gives two different answers for the same timestamp.
 */
export const TIME_ZONE = "Asia/Colombo";

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Postgres hands back two shapes and they must not be treated the same way:
 * a `date` column arrives as `2026-09-03`, a `timestamptz` as a full ISO
 * instant with an offset already on it.
 *
 * A calendar day is not an instant - `pickup_date` is the day the agent knocks
 * on the door - so it is anchored to UTC and read back in UTC, which keeps it
 * the same day no matter where it is rendered. A real instant is read back in
 * Puttalam time.
 */
function parse(value: string): { date: Date; dayOnly: boolean } {
  const dayOnly = DAY_ONLY.test(value);
  return { date: new Date(dayOnly ? value + "T00:00:00Z" : value), dayOnly };
}

/** `2026-09-03` -> `03 Sep 2026`. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const { date, dayOnly } = parse(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    timeZone: dayOnly ? "UTC" : TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Timestamps are stored in UTC; render them on Puttalam's clock. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const { date, dayOnly } = parse(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    timeZone: dayOnly ? "UTC" : TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "-";
  const { date, dayOnly } = parse(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-GB", {
    timeZone: dayOnly ? "UTC" : TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/* `en-CA` renders a date as YYYY-MM-DD, which is the shape the database uses. */
const DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** The calendar day `at` falls on in Puttalam, as `YYYY-MM-DD`. */
export function dayIn(at: Date = new Date()): string {
  return DAY.format(at);
}

/** Minutes past midnight in Puttalam - the clock the round actually runs on. */
export function minutesIntoDay(at: Date = new Date()): number {
  const parts = CLOCK.formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return (hour % 24) * 60 + minute;
}

export function relativeDay(date: string): string {
  if (date === today()) return "Today";
  if (date === dayIn(new Date(Date.now() + 86_400_000))) return "Tomorrow";
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

/** Today as `YYYY-MM-DD` in Puttalam, wherever this happens to run. */
export function today(): string {
  return dayIn();
}
