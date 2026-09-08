"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Notice } from "@/components/patterns";
import { api, messageFrom } from "@/lib/client";
import type { OrderWithDetails } from "@/lib/types";

/**
 * FR-011: find an order by the number printed on the bag tag. The QR code on the
 * tag encodes the same string, so a scanner that types into this field works too.
 */
export function OrderLookup() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    try {
      const found = await api<{ order: OrderWithDetails }>(
        `/api/shop/orders/${encodeURIComponent(trimmed.toUpperCase())}`,
      );
      router.push(`/shop/orders/${found.order.id}`);
    } catch (cause) {
      setError(messageFrom(cause));
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={submit}>
        <label className="flex-1">
          <span className="eyebrow mb-1.5 block">Find a bag</span>
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Scan or type PU-2026-0001"
            className="tabular"
            autoComplete="off"
          />
        </label>
        <Button type="submit" disabled={busy} className="sm:mt-6">
          {busy ? "Looking…" : "Open order"}
        </Button>
      </form>
      {error ? (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
    </Card>
  );
}
