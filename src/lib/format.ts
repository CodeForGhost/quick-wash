import type { OrderStatus } from "./types";

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return "LKR " + value.toLocaleString("en-LK", { maximumFractionDigits: 2 });
}

/** `2026-09-03` -> `03 Sep 2026`. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value.includes("T") || value.includes(" ") ? value.replace(" ", "T") + "Z" : value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** SQLite timestamps are stored in UTC; render them in the viewer's timezone. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
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
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
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
