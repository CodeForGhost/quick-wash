"use client";

import { useState } from "react";
import { Button, Card, Field, Input, Notice, SectionHeading, cx } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";
import { formatPrice } from "@/lib/format";
import { SHOP_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/types";

/** The one status the shop can move to next, given where the order is now. */
const NEXT: Partial<Record<OrderStatus, (typeof SHOP_STATUSES)[number]>> = {
  PICKED_UP: "AT_LAUNDRY",
  AT_LAUNDRY: "WASHING",
  WASHING: "DRYING",
  DRYING: "IRONING",
  IRONING: "READY",
};

/** The wording on the button that performs each move. */
const ACTION_LABEL: Record<(typeof SHOP_STATUSES)[number], string> = {
  AT_LAUNDRY: "Confirm received",
  WASHING: "Start washing",
  DRYING: "Move to drying",
  IRONING: "Move to ironing",
  READY: "Mark ready",
};

/** FR-012 to FR-015: advance processing and set the final price. */
export function ProcessingControls({
  orderId,
  status,
  price,
  itemCount,
}: {
  orderId: number;
  status: OrderStatus;
  price: number | null;
  itemCount: number | null;
}) {
  // Two independent actions on one screen, so the busy state is keyed: setting
  // the price must not make the stage button look like it is advancing.
  const { run, busy, isBusy, error } = useAction();
  const [priceInput, setPriceInput] = useState(price ? String(price) : "");
  const [saved, setSaved] = useState("");

  const next = NEXT[status];
  const stage = SHOP_STATUSES.indexOf(status as (typeof SHOP_STATUSES)[number]);

  function advance() {
    if (!next) return;
    setSaved("");
    void run("advance", async () => {
      await api(`/api/shop/orders/${orderId}/status`, { method: "PATCH", json: { status: next } });
      // The stage rail above is server-rendered: hold the spinner until it moves.
      return { refresh: true };
    });
  }

  function savePrice(event: React.FormEvent) {
    event.preventDefault();
    setSaved("");
    void run("price", async () => {
      await api(`/api/shop/orders/${orderId}/price`, {
        method: "PATCH",
        json: { price: Number(priceInput) },
      });
      setSaved("Price saved. The customer can see it now.");
      return { refresh: true };
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionHeading eyebrow="FR-013" title="Processing" />

        {/* The five shop stages, so staff can see the step they are on. */}
        <ol className="mb-5 flex gap-1.5">
          {SHOP_STATUSES.map((step, index) => (
            <li key={step} className="flex-1">
              <span
                aria-hidden
                className={cx(
                  "block h-1.5 rounded-full",
                  stage >= index && stage >= 0 ? "bg-lagoon" : "bg-hairline",
                )}
              />
              <span
                className={cx(
                  "mt-1.5 block text-[10px] leading-tight",
                  stage === index ? "font-bold text-lagoon" : "text-ink-faint",
                )}
              >
                {STATUS_LABELS[step]}
              </span>
            </li>
          ))}
        </ol>

        {next ? (
          <Button
            type="button"
            tone="accent"
            onClick={advance}
            loading={isBusy("advance")}
            disabled={busy}
            className="w-full"
          >
            {isBusy("advance") ? "Updating…" : ACTION_LABEL[next]}
          </Button>
        ) : status === "READY" ? (
          <p className="rounded-xl bg-lagoon-soft px-4 py-3 text-sm font-medium text-lagoon-deep">
            Ready to go. An administrator will assign a delivery agent.
          </p>
        ) : (
          <p className="rounded-xl bg-ground px-4 py-3 text-sm text-ink-soft">
            {status === "PENDING" || status === "PICKUP_ASSIGNED"
              ? "This order has not reached the shop yet."
              : "This order has left the shop."}
          </p>
        )}

        <Notice tone="error">{error}</Notice>
      </Card>

      <Card className="p-5">
        <SectionHeading eyebrow="FR-014" title="Final price" />
        <p className="mb-4 text-sm text-ink-soft">
          {itemCount
            ? `The customer estimated ${itemCount} items. Enter what you are charging once you have counted.`
            : "Enter what you are charging once you have counted the items."}
        </p>

        <form className="space-y-4" onSubmit={savePrice}>
          <Field label="Price (LKR)">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="1250"
              className="tabular"
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              required
            />
          </Field>

          <Notice tone="success">{saved}</Notice>

          <div className="flex items-center gap-3">
            <Button type="submit" loading={isBusy("price")} disabled={busy || priceInput === ""}>
              {isBusy("price") ? "Saving…" : price ? "Update price" : "Set price"}
            </Button>
            {price ? (
              <span className="tabular text-sm text-ink-soft">Currently {formatPrice(price)}</span>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
