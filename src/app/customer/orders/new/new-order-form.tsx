"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Input, Notice, Textarea, cx } from "@/components/patterns";
import { api, messageFrom } from "@/lib/client";
import { TIME_SLOTS, type Address } from "@/lib/types";

/** The next seven days, so the customer picks a day rather than typing a date. */
function upcomingDays(count = 7) {
  const offset = new Date().getTimezoneOffset() * 60_000;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.now() + index * 86_400_000 - offset);
    const value = date.toISOString().slice(0, 10);
    return {
      value,
      weekday: index === 0 ? "Today" : index === 1 ? "Tomorrow" : date.toLocaleDateString("en-GB", { weekday: "short" }),
      day: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    };
  });
}

/** FR-005: the pickup request form. */
export function NewOrderForm({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const days = upcomingDays();

  const [addressId, setAddressId] = useState(addresses[0]?.id ?? 0);
  const [pickupDate, setPickupDate] = useState(days[0].value);
  const [slot, setSlot] = useState<string>(TIME_SLOTS[0]);
  const [bags, setBags] = useState(1);
  const [items, setItems] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const order = await api<{ id: number }>("/api/orders", {
        method: "POST",
        json: {
          address_id: addressId,
          pickup_date: pickupDate,
          pickup_time_slot: slot,
          bag_count: bags,
          item_count: items ? Number(items) : null,
          notes: notes || undefined,
        },
      });
      router.replace(`/customer/orders/${order.id}?created=1`);
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause));
      setBusy(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <Card className="p-5">
        <p className="eyebrow mb-3">Where we collect from</p>
        <div className="space-y-2">
          {addresses.map((address) => (
            <label
              key={address.id}
              className={cx(
                "flex cursor-pointer gap-3 rounded-xl border p-3.5 transition",
                addressId === address.id ? "border-lagoon bg-lagoon-soft/50" : "border-hairline hover:border-ink-faint",
              )}
            >
              <input
                type="radio"
                name="address"
                className="mt-1 size-4 shrink-0"
                checked={addressId === address.id}
                onChange={() => setAddressId(address.id)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{address.label}</span>
                <span className="block whitespace-pre-line text-sm text-ink-soft">{address.address}</span>
                {address.landmark ? (
                  <span className="mt-0.5 block text-xs text-ink-faint">Landmark: {address.landmark}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="eyebrow mb-3">Pickup day</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => setPickupDate(day.value)}
              aria-pressed={pickupDate === day.value}
              className={cx(
                "min-w-20 shrink-0 rounded-xl border px-3 py-2.5 text-center transition",
                pickupDate === day.value
                  ? "border-ink bg-ink text-white"
                  : "border-hairline text-ink hover:border-ink-faint",
              )}
            >
              <span className="block text-xs font-semibold">{day.weekday}</span>
              <span className="tabular mt-0.5 block text-xs opacity-70">{day.day}</span>
            </button>
          ))}
        </div>

        <p className="eyebrow mb-3 mt-6">Time window</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TIME_SLOTS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSlot(option)}
              aria-pressed={slot === option}
              className={cx(
                "tabular rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                slot === option ? "border-lagoon bg-lagoon-soft text-lagoon-deep" : "border-hairline text-ink hover:border-ink-faint",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <p className="eyebrow">What you are sending</p>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">Number of bags</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBags((n) => Math.max(1, n - 1))}
              aria-label="One bag fewer"
              className="size-11 rounded-full border border-hairline text-lg font-bold text-ink transition hover:border-ink-faint"
            >
              −
            </button>
            <span className="tabular w-12 text-center font-display text-2xl font-bold text-ink">{bags}</span>
            <button
              type="button"
              onClick={() => setBags((n) => Math.min(50, n + 1))}
              aria-label="One bag more"
              className="size-11 rounded-full border border-hairline text-lg font-bold text-ink transition hover:border-ink-faint"
            >
              +
            </button>
          </div>
        </div>

        <Field label="Roughly how many items" hint="An estimate is fine. The shop counts them properly.">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            placeholder="15"
            value={items}
            onChange={(event) => setItems(event.target.value)}
          />
        </Field>

        <Field label="Anything we should know" hint="Optional.">
          <Textarea
            rows={3}
            placeholder="Please handle white clothes separately."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </Card>

      <Notice tone="error">{error}</Notice>

      <div className="flex gap-3">
        <Button type="submit" tone="accent" disabled={busy} className="flex-1 sm:flex-none">
          {busy ? "Sending your request…" : "Request pickup"}
        </Button>
      </div>
    </form>
  );
}
