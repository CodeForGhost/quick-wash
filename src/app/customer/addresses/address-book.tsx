"use client";

import { useState } from "react";
import { Button, Card, EmptyState, Field, Input, Notice, Spinner, Textarea } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";
import type { Address } from "@/lib/types";

type Draft = {
  label: string;
  address: string;
  area: string;
  landmark: string;
  phone: string;
};

const EMPTY: Draft = { label: "Home", address: "", area: "", landmark: "", phone: "" };

/** FR-004: add, edit and remove saved addresses. */
export function AddressBook({ initial, defaultPhone }: { initial: Address[]; defaultPhone: string }) {
  const { run, busy, isBusy, error, setError } = useAction();
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<number | "new" | null>(initial.length === 0 ? "new" : null);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY, phone: defaultPhone });

  function startNew() {
    setDraft({ ...EMPTY, phone: defaultPhone });
    setEditing("new");
    setError("");
  }

  function startEdit(address: Address) {
    setDraft({
      label: address.label,
      address: address.address,
      area: address.area ?? "",
      landmark: address.landmark ?? "",
      phone: address.phone ?? "",
    });
    setEditing(address.id);
    setError("");
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    void run("save", async () => {
      if (editing === "new") {
        const created = await api<Address>("/api/customers/addresses", { method: "POST", json: draft });
        setAddresses((list) => [...list, created]);
      } else if (typeof editing === "number") {
        const updated = await api<Address>(`/api/customers/addresses/${editing}`, { method: "PUT", json: draft });
        setAddresses((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      }
      setEditing(null);
      return { refresh: true };
    });
  }

  /** Keyed by row: only the address being removed shows a spinner. */
  function remove(id: number) {
    void run(`remove:${id}`, async () => {
      await api(`/api/customers/addresses/${id}`, { method: "DELETE" });
      setAddresses((list) => list.filter((item) => item.id !== id));
      return { refresh: true };
    });
  }

  const form = (
    <Card className="p-5">
      <p className="eyebrow mb-4">{editing === "new" ? "New address" : "Edit address"}</p>
      <form className="space-y-4" onSubmit={save}>
        <Field label="Name this place" hint="Home, Shop, Mother's house - whatever you will recognise." required>
          <Input
            value={draft.label}
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            placeholder="Home"
            required
          />
        </Field>

        <Field label="Address" required>
          <Textarea
            rows={3}
            value={draft.address}
            onChange={(event) => setDraft({ ...draft, address: event.target.value })}
            placeholder={"No. 25,\nMain Street, Puttalam"}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Area">
            <Input
              value={draft.area}
              onChange={(event) => setDraft({ ...draft, area: event.target.value })}
              placeholder="Puttalam Town"
            />
          </Field>
          <Field label="Landmark" hint="Helps the agent find you.">
            <Input
              value={draft.landmark}
              onChange={(event) => setDraft({ ...draft, landmark: event.target.value })}
              placeholder="Near Zahira College"
            />
          </Field>
        </div>

        <Field label="Contact number for this address">
          <Input
            type="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            placeholder="07X XXX XXXX"
          />
        </Field>

        <Notice tone="error">{error}</Notice>

        <div className="flex gap-2">
          <Button type="submit" tone="accent" loading={isBusy("save")} disabled={busy}>
            {isBusy("save") ? "Saving…" : "Save address"}
          </Button>
          {addresses.length > 0 ? (
            <Button type="button" tone="quiet" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );

  return (
    <div className="space-y-4">
      {addresses.length === 0 && editing !== "new" ? (
        <EmptyState
          title="No addresses saved"
          body="Add the place we should collect your laundry from."
          action={
            <Button type="button" tone="accent" onClick={startNew}>
              Add an address
            </Button>
          }
        />
      ) : null}

      {addresses.map((address) =>
        editing === address.id ? (
          <div key={address.id}>{form}</div>
        ) : (
          <Card key={address.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{address.label}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{address.address}</p>
                {address.area ? <p className="mt-1 text-sm text-ink-soft">{address.area}</p> : null}
                {address.landmark ? (
                  <p className="mt-1 text-xs text-ink-faint">Landmark: {address.landmark}</p>
                ) : null}
                {address.phone ? <p className="tabular mt-1 text-xs text-ink-faint">{address.phone}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(address)}
                  className="text-sm font-semibold text-lagoon underline underline-offset-4"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(address.id)}
                  disabled={busy}
                  aria-busy={isBusy(`remove:${address.id}`) || undefined}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-faint underline underline-offset-4 hover:text-flag disabled:no-underline disabled:opacity-50 aria-busy:text-flag aria-busy:opacity-100"
                >
                  {isBusy(`remove:${address.id}`) ? <Spinner aria-hidden data-icon="inline-start" className="size-3.5 shrink-0" /> : null}
                  {isBusy(`remove:${address.id}`) ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          </Card>
        ),
      )}

      {editing === "new" ? form : null}

      {editing === null ? (
        <Button type="button" tone="quiet" onClick={startNew}>
          Add another address
        </Button>
      ) : null}
    </div>
  );
}
