"use client";

import { useState } from "react";
import { Button, Input, Notice } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";

/** FR-010: record the real bag count and mark the laundry collected. */
export function MarkPickedUp({ orderId, expectedBags }: { orderId: number; expectedBags: number }) {
  const { run, busy, error } = useAction();
  const [bags, setBags] = useState(expectedBags);
  const [notes, setNotes] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void run("pickup", async () => {
      await api(`/api/agent/orders/${orderId}/pickup`, {
        method: "POST",
        json: { actual_bag_count: bags, notes: notes || undefined },
      });
      return { refresh: true };
    });
  }

  return (
    <form className="mt-5 space-y-4 border-t border-hairline pt-5" onSubmit={submit}>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-ink">Bags actually collected</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setBags((n) => Math.max(1, n - 1))}
            disabled={busy}
            aria-label="One bag fewer"
            className="size-11 rounded-full border border-hairline text-lg font-bold text-ink transition hover:border-ink-faint disabled:opacity-50"
          >
            −
          </button>
          <span className="tabular w-12 text-center font-display text-2xl font-bold text-ink">{bags}</span>
          <button
            type="button"
            onClick={() => setBags((n) => Math.min(50, n + 1))}
            disabled={busy}
            aria-label="One bag more"
            className="size-11 rounded-full border border-hairline text-lg font-bold text-ink transition hover:border-ink-faint disabled:opacity-50"
          >
            +
          </button>
          {bags !== expectedBags ? (
            <span className="text-xs text-sun">Customer said {expectedBags}</span>
          ) : null}
        </div>
      </div>

      <Input
        placeholder="Note for the shop (optional)"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      <Notice tone="error">{error}</Notice>

      <Button type="submit" tone="accent" loading={busy} className="w-full">
        {busy ? "Recording…" : "Mark picked up"}
      </Button>
    </form>
  );
}
