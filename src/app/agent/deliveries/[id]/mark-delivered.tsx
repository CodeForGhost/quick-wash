"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Notice } from "@/components/patterns";
import { api, messageFrom } from "@/lib/client";

/** FR-017: close the loop - the laundry is back with the customer. */
export function MarkDelivered({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/agent/orders/${orderId}/deliver`, {
        method: "POST",
        json: { notes: notes || undefined },
      });
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause));
      setBusy(false);
    }
  }

  return (
    <form className="mt-5 space-y-4 border-t border-hairline pt-5" onSubmit={submit}>
      <Input
        placeholder="Note (optional) - e.g. handed to neighbour"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <Notice tone="error">{error}</Notice>
      <Button type="submit" tone="accent" disabled={busy} className="w-full">
        {busy ? "Recording…" : "Mark delivered"}
      </Button>
    </form>
  );
}
