"use client";

import { Button, Notice } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";

export function MarkAllRead() {
  const { run, busy, error } = useAction();

  function markRead() {
    void run("mark", async () => {
      await api("/api/notifications", { method: "POST" });
      // The list itself is server-rendered, so the button is only finished
      // once the refreshed list has replaced the unread one.
      return { refresh: true };
    });
  }

  return (
    <div className="mb-6 space-y-3">
      <Button type="button" tone="quiet" onClick={markRead} loading={busy}>
        {busy ? "Marking…" : "Mark all read"}
      </Button>
      <Notice tone="error">{error}</Notice>
    </div>
  );
}
