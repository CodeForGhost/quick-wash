"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Field, Input, Notice, Textarea, cx } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";
import { TIME_SLOTS, type Address } from "@/lib/types";
import { TIME_ZONE, dayIn, minutesIntoDay } from "@/lib/format";

/**
 * The next seven days, so the customer picks a day rather than typing a date.
 * The days are Puttalam's - a customer travelling, or a phone with its clock
 * set elsewhere, still books against the day the agent will actually drive.
 */
function upcomingDays(count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.now() + index * 86_400_000);
    return {
      value: dayIn(date),
      today: index === 0,
      weekday:
        index === 0
          ? "Today"
          : index === 1
            ? "Tomorrow"
            : date.toLocaleDateString("en-GB", { timeZone: TIME_ZONE, weekday: "short" }),
      day: date.toLocaleDateString("en-GB", { timeZone: TIME_ZONE, day: "2-digit", month: "short" }),
    };
  });
}

/** Minutes past midnight that a slot opens, read off its "08:00 AM - 10:00 AM" label. */
function slotOpensAt(slot: string): number {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(slot);
  if (!match) return 0; // A label we cannot read stays on offer rather than vanishing.
  const [, hour, minute, meridiem] = match;
  const hours = (Number(hour) % 12) + (meridiem.toUpperCase() === "PM" ? 12 : 0);
  return hours * 60 + Number(minute);
}

/**
 * The windows still worth offering on a given day. A window that has already
 * opened cannot be collected in, so today loses its slots as the day goes on
 * and every other day keeps all five.
 *
 * `now` is null until the component has mounted. The zone is fixed, so server
 * and client agree on it, but the clock still moves between the two renders -
 * so the server-rendered first paint offers everything and the browser narrows
 * it rather than risking a mismatch on a slot boundary.
 */
function slotsOn(day: { today: boolean }, now: number | null): readonly string[] {
  if (!day.today || now === null) return TIME_SLOTS;
  return TIME_SLOTS.filter((slot) => slotOpensAt(slot) > now);
}

/** Minutes past midnight in Puttalam, re-read each minute. */
function useMinutesIntoDay(): number | null {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    function read() {
      setMinutes(minutesIntoDay());
    }
    read();
    // A form left open long enough to outlast a window must not offer it.
    const timer = setInterval(read, 60_000);
    return () => clearInterval(timer);
  }, []);

  return minutes;
}

/** FR-005: the pickup request form. */
export function NewOrderForm({ addresses }: { addresses: Address[] }) {
  const { run, busy, error } = useAction();
  const minutes = useMinutesIntoDay();

  const [addressId, setAddressId] = useState(addresses[0]?.id ?? 0);
  const [pickupDate, setPickupDate] = useState(() => dayIn());
  const [slot, setSlot] = useState<string>(TIME_SLOTS[0]);
  const [bags, setBags] = useState(1);
  const [items, setItems] = useState("");
  const [notes, setNotes] = useState("");

  // Today drops out of the picker entirely once its last window has opened,
  // rather than offering a day with nothing bookable on it.
  const days = useMemo(
    () => upcomingDays().filter((day) => slotsOn(day, minutes).length > 0),
    [minutes],
  );

  // What is actually chosen, which is not always what was clicked: a window
  // can open - or today can run out - while the form is sitting there. Deriving
  // it rather than storing it means the request can never carry a stale slot.
  const chosenDay = days.find((day) => day.value === pickupDate) ?? days[0];
  const slots = chosenDay ? slotsOn(chosenDay, minutes) : TIME_SLOTS;
  const chosenSlot = slots.includes(slot) ? slot : slots[0];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void run("request", async () => {
      const order = await api<{ id: number }>("/api/orders", {
        method: "POST",
        json: {
          address_id: addressId,
          pickup_date: chosenDay?.value ?? pickupDate,
          pickup_time_slot: chosenSlot,
          bag_count: bags,
          item_count: items ? Number(items) : null,
          notes: notes || undefined,
        },
      });
      // Still busy: the request is placed, but the confirmation screen it
      // navigates to is what tells the customer so.
      return { replace: `/customer/orders/${order.id}?created=1`, refresh: true };
    });
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
              aria-pressed={chosenDay?.value === day.value}
              className={cx(
                "min-w-20 shrink-0 rounded-xl border px-3 py-2.5 text-center transition",
                chosenDay?.value === day.value
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
          {slots.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSlot(option)}
              aria-pressed={chosenSlot === option}
              className={cx(
                "tabular rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                chosenSlot === option ? "border-lagoon bg-lagoon-soft text-lagoon-deep" : "border-hairline text-ink hover:border-ink-faint",
              )}
            >
              {option}
            </button>
          ))}
        </div>
        {chosenDay?.today && slots.length < TIME_SLOTS.length ? (
          <p className="mt-2 text-xs text-ink-faint">
            Earlier windows today have already opened. Pick another day for those.
          </p>
        ) : null}
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
        <Button type="submit" tone="accent" loading={busy} className="flex-1 sm:flex-none">
          {busy ? "Sending your request…" : "Request pickup"}
        </Button>
      </div>
    </form>
  );
}
