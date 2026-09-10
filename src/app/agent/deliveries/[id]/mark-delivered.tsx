"use client";

import { useState } from "react";
import { Button, Input, Notice } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";

/** FR-017: close the loop - the laundry is back with the customer. */
export function MarkDelivered({ orderId }: { orderId: number }) {
  const { run, busy, error } = useAction();
  const [notes, setNotes] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void run("deliver", async () => {
      await api(`/api/agent/orders/${orderId}/deliver`, {
        method: "POST",
        json: { notes: notes || undefined },
      });
      return { refresh: true };
    });
  }

  return (
    <form className="mt-5 space-y-4 border-t border-hairline pt-5" onSubmit={submit}>
      <Input
        placeholder="Note (optional) - e.g. handed to neighbour"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <Notice tone="error">{error}</Notice>
      <Button type="submit" tone="accent" loading={busy} className="w-full">
        {busy ? "Recording…" : "Mark delivered"}
      </Button>
    </form>
  );
}
