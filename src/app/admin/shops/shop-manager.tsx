"use client";

import { useState } from "react";
import { Button, Card, Field, Input, Notice, SectionHeading, Textarea, cx } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";
import type { LaundryShop } from "@/lib/types";

type Draft = { name: string; phone: string; address: string; is_active: boolean };

const EMPTY: Draft = { name: "", phone: "", address: "", is_active: true };

/** FR-026: add, edit and deactivate shops. */
export function ShopManager({ shops }: { shops: LaundryShop[] }) {
  const { run, busy, error, setError } = useAction();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  function startNew() {
    setDraft(EMPTY);
    setEditing("new");
    setError("");
  }

  function startEdit(shop: LaundryShop) {
    setDraft({
      name: shop.name,
      phone: shop.phone ?? "",
      address: shop.address ?? "",
      is_active: Boolean(shop.is_active),
    });
    setEditing(shop.id);
    setError("");
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    void run("save", async () => {
      if (editing === "new") {
        await api("/api/admin/shops", { method: "POST", json: draft });
      } else if (typeof editing === "number") {
        await api(`/api/admin/shops/${editing}`, { method: "PUT", json: draft });
      }
      setEditing(null);
      return { refresh: true };
    });
  }

  const form = (
    <Card className="p-5">
      <SectionHeading eyebrow={editing === "new" ? "New shop" : "Edit shop"} title="Shop details" />
      <form className="space-y-4" onSubmit={save}>
        <Field label="Shop name" required>
          <Input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Puttalam Central Laundry"
            required
          />
        </Field>

        <Field label="Phone">
          <Input
            type="tel"
            value={draft.phone}
            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            placeholder="032 226 5100"
          />
        </Field>

        <Field label="Address">
          <Textarea
            rows={2}
            value={draft.address}
            onChange={(event) => setDraft({ ...draft, address: event.target.value })}
            placeholder="No. 12, Kurunegala Road, Puttalam"
          />
        </Field>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            className="size-4"
            checked={draft.is_active}
            onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
          />
          <span className="text-sm font-medium text-ink">Accepting orders</span>
        </label>

        <Notice tone="error">{error}</Notice>

        <div className="flex gap-2">
          <Button type="submit" tone="accent" loading={busy}>
            {busy ? "Saving…" : "Save shop"}
          </Button>
          <Button type="button" tone="quiet" onClick={() => setEditing(null)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );

  return (
    <div className="space-y-4">
      {shops.map((shop) =>
        editing === shop.id ? (
          <div key={shop.id}>{form}</div>
        ) : (
          <Card key={shop.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display tracking-tighter text-lg font-semibold text-ink">{shop.name}</p>
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      shop.is_active ? "bg-lagoon-soft text-lagoon-deep" : "bg-ground text-ink-faint",
                    )}
                  >
                    {shop.is_active ? "Accepting orders" : "Closed"}
                  </span>
                </div>
                {shop.address ? (
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{shop.address}</p>
                ) : null}
                {shop.phone ? <p className="tabular mt-1 text-sm text-ink-soft">{shop.phone}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => startEdit(shop)}
                className="shrink-0 text-sm font-semibold text-lagoon underline underline-offset-4"
              >
                Edit
              </button>
            </div>
          </Card>
        ),
      )}

      {editing === "new" ? form : null}

      {editing === null ? (
        <Button type="button" tone="quiet" onClick={startNew}>
          Add a laundry shop
        </Button>
      ) : null}
    </div>
  );
}
