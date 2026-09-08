import { statusIndex } from "@/lib/orders";
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { cx } from "./patterns";

/**
 * FR-018 order tracking.
 *
 * The ten stages of the SRS state machine are a real sequence, so they are drawn
 * as a rail: a continuous line that fills up to wherever the laundry has reached.
 * Stacked on a phone, laid out horizontally from `sm` up.
 */
export function PipelineRail({ status, className }: { status: OrderStatus; className?: string }) {
  if (status === "CANCELLED") {
    return (
      <div className={cx("rounded-card border border-flag/20 bg-flag-soft px-4 py-3", className)}>
        <p className="eyebrow text-flag/70">Order stopped</p>
        <p className="mt-1 text-sm font-semibold text-flag">This order was cancelled and will not be collected.</p>
      </div>
    );
  }

  const current = statusIndex(status);
  const total = ORDER_STATUSES.length;
  const progress = total > 1 ? current / (total - 1) : 0;

  return (
    <div className={className}>
      {/* Phone: a vertical rail, so the long stage names stay readable. */}
      <ol className="sm:hidden">
        {ORDER_STATUSES.map((stage, index) => {
          const state = index < current ? "done" : index === current ? "current" : "todo";
          return (
            <li key={stage} className="relative flex gap-3 pb-4 last:pb-0">
              {index < total - 1 ? (
                <span
                  aria-hidden
                  className={cx(
                    "absolute left-[7px] top-4 h-full w-0.5",
                    index < current ? "bg-lagoon" : "bg-hairline",
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cx(
                  "relative z-10 mt-1 size-4 shrink-0 rounded-full border-2",
                  state === "done" && "border-lagoon bg-lagoon",
                  state === "current" && "border-lagoon bg-surface ring-4 ring-lagoon-soft",
                  state === "todo" && "border-hairline bg-surface",
                )}
              />
              <span
                className={cx(
                  "text-sm leading-6",
                  state === "todo" ? "text-ink-faint" : "font-semibold text-ink",
                )}
              >
                {STATUS_LABELS[stage]}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Tablet and up: the rail runs left to right with stations beneath it. */}
      <div className="hidden sm:block">
        <div className="relative h-4">
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-hairline" />
          <span
            aria-hidden
            className="rail-fill absolute inset-y-0 left-0 top-1/2 h-0.5 -translate-y-1/2 bg-lagoon"
            style={{ width: `${progress * 100}%` }}
          />
          <ol className="absolute inset-0 flex items-center justify-between">
            {ORDER_STATUSES.map((stage, index) => {
              const state = index < current ? "done" : index === current ? "current" : "todo";
              return (
                <li key={stage} className="relative">
                  <span
                    aria-hidden
                    className={cx(
                      "block size-3.5 rounded-full border-2",
                      state === "done" && "border-lagoon bg-lagoon",
                      state === "current" && "size-4 border-lagoon bg-surface ring-4 ring-lagoon-soft",
                      state === "todo" && "border-hairline bg-ground",
                    )}
                  />
                  <span className="sr-only">{STATUS_LABELS[stage]}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <ol aria-hidden className="mt-3 flex justify-between gap-1">
          {ORDER_STATUSES.map((stage, index) => (
            <li
              key={stage}
              className={cx(
                "flex-1 text-center text-[10px] leading-tight",
                index === current ? "font-bold text-lagoon" : index < current ? "text-ink-soft" : "text-ink-faint",
              )}
            >
              {STATUS_LABELS[stage]}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * FR-023 admin overview. The same rail, but each station carries the number of
 * orders sitting at it, so a glance shows where work is piling up.
 */
export function PipelineLoad({ counts }: { counts: Record<string, number> }) {
  const peak = Math.max(1, ...ORDER_STATUSES.map((s) => counts[s] ?? 0));

  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-[640px] items-end gap-1">
        {ORDER_STATUSES.map((stage, index) => {
          const count = counts[stage] ?? 0;
          const height = count === 0 ? 4 : Math.max(10, Math.round((count / peak) * 72));
          return (
            <li key={stage} className="station-in flex flex-1 flex-col items-center gap-2" style={{ animationDelay: `${index * 40}ms` }}>
              <span className={cx("tabular text-sm font-semibold", count ? "text-ink" : "text-ink-faint")}>
                {count}
              </span>
              <span
                aria-hidden
                className={cx("w-full rounded-t-sm", count ? "bg-lagoon" : "bg-hairline")}
                style={{ height }}
              />
              <span className="h-8 text-center text-[10px] leading-tight text-ink-soft">
                {STATUS_LABELS[stage]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
