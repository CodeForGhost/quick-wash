"use client";

import { useState } from "react";
import { Button, Input, Notice } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";

/** Cancelling is only offered while the laundry has not been collected yet. */
export function CancelOrder({ orderId }: { orderId: number }) {
  const { run, busy, error } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  function cancel() {
    void run("cancel", async () => {
      await api(`/api/orders/${orderId}/cancel`, { method: "POST", json: { reason } });
      setOpen(false);
      return { refresh: true };
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 text-sm font-semibold text-flag underline underline-offset-4"
      >
        Cancel this pickup
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-flag/25 bg-flag-soft/50 p-4">
      <p className="text-sm font-semibold text-ink">Cancel this pickup?</p>
      <p className="text-sm text-ink-soft">
        The agent will be told not to come. You can book again whenever you are ready.
      </p>
      <Input
        placeholder="Reason (optional)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <Notice tone="error">{error}</Notice>
      <div className="flex gap-2">
        <Button type="button" tone="danger" onClick={cancel} loading={busy}>
          {busy ? "Cancelling…" : "Yes, cancel it"}
        </Button>
        <Button type="button" tone="quiet" onClick={() => setOpen(false)} disabled={busy}>
          Keep the pickup
        </Button>
      </div>
    </div>
  );
}
