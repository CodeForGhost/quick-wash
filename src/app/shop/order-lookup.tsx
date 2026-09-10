"use client";

import { useState } from "react";
import { Button, Card, Input, Notice } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";
import type { OrderWithDetails } from "@/lib/types";

/**
 * FR-011: find an order by the number printed on the bag tag. The QR code on the
 * tag encodes the same string, so a scanner that types into this field works too.
 */
export function OrderLookup() {
  const { run, busy, error } = useAction();
  const [code, setCode] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    void run("lookup", async () => {
      const found = await api<{ order: OrderWithDetails }>(
        `/api/shop/orders/${encodeURIComponent(trimmed.toUpperCase())}`,
      );
      // A scan should keep spinning until the order is actually on screen.
      return { push: `/shop/orders/${found.order.id}` };
    });
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
        <Button type="submit" loading={busy} disabled={code.trim() === ""} className="sm:mt-6">
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
