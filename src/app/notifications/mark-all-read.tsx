"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/patterns";
import { api } from "@/lib/client";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markRead() {
    setBusy(true);
    try {
      await api("/api/notifications", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" tone="quiet" onClick={markRead} disabled={busy} className="mb-6">
      {busy ? "Marking…" : "Mark all read"}
    </Button>
  );
}
