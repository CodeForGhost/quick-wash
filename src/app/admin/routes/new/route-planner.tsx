"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Field,
  Input,
  Notice,
  SectionHeading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cx,
} from "@/components/patterns";
import { api, messageFrom } from "@/lib/client";
import { formatDate } from "@/lib/format";

interface Candidate {
  id: number;
  order_number: string;
  customer_name: string;
  bag_count: number;
  area: string | null;
  address: string;
  pickup_date: string;
  time_slot: string;
  assigned_to: string | null;
}

function todayString(): string {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** FR-022: build a route by picking stops in the order they should be driven. */
export function RoutePlanner({
  orders,
  agents,
}: {
  orders: Candidate[];
  agents: Array<{ id: number; name: string; load: number }>;
}) {
  const router = useRouter();
  const [agentId, setAgentId] = useState(agents[0]?.id ?? 0);
  const [routeDate, setRouteDate] = useState(todayString());
  const [name, setName] = useState("");
  // Selection order is the stop order, so this stays an array, not a set.
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Grouping by area is the closest thing to route planning the MVP does;
  // real optimisation is explicitly out of scope (SRS 5.2).
  const byArea = useMemo(() => {
    const groups = new Map<string, Candidate[]>();
    for (const order of orders) {
      const key = order.area ?? "Other";
      groups.set(key, [...(groups.get(key) ?? []), order]);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [orders]);

  const bags = orders
    .filter((order) => picked.includes(order.id))
    .reduce((total, order) => total + order.bag_count, 0);

  function toggle(id: number) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/routes", {
        method: "POST",
        json: { name: name || undefined, agent_id: agentId, route_date: routeDate, order_ids: picked },
      });
      router.push("/admin/routes");
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {byArea.map(([area, group]) => (
            <Card key={area} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
                <p className="font-semibold text-ink">{area}</p>
                <p className="text-xs text-ink-soft">
                  {group.length} {group.length === 1 ? "stop" : "stops"}
                </p>
              </div>
              <ul className="divide-y divide-hairline">
                {group.map((order) => {
                  const position = picked.indexOf(order.id);
                  const selected = position !== -1;
                  return (
                    <li key={order.id}>
                      <label
                        className={cx(
                          "flex cursor-pointer items-center gap-4 px-5 py-3 transition",
                          selected ? "bg-lagoon-soft/40" : "hover:bg-ground/40",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-4 shrink-0"
                          checked={selected}
                          onChange={() => toggle(order.id)}
                        />
                        <span
                          aria-hidden
                          className={cx(
                            "tabular flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            selected ? "bg-lagoon text-white" : "bg-ground text-ink-faint",
                          )}
                        >
                          {selected ? position + 1 : "–"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="tabular block text-xs text-ink-faint">{order.order_number}</span>
                          <span className="block truncate font-medium text-ink">{order.customer_name}</span>
                          <span className="block truncate text-xs text-ink-soft">{order.address}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-ink-soft">
                          <span className="tabular block font-semibold text-ink">{order.bag_count} bags</span>
                          {formatDate(order.pickup_date)}
                          {order.assigned_to ? (
                            <span className="block text-sun">with {order.assigned_to.split(" ")[0]}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>

        <Card className="sticky top-20 h-fit p-5">
          <SectionHeading eyebrow="This route" title="Round details" />

          <div className="space-y-4">
            <Field label="Agent" required>
              <Select value={String(agentId)} onValueChange={(value) => setAgentId(Number(value))} required>
                <SelectTrigger>
                  <SelectValue placeholder="Pick an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.name} - {agent.load} already assigned
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Date" required>
              <Input
                type="date"
                value={routeDate}
                onChange={(event) => setRouteDate(event.target.value)}
                required
              />
            </Field>

            <Field label="Name this round" hint="Optional - e.g. Town morning.">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Town morning" />
            </Field>
          </div>

          <dl className="mt-5 border-t border-hairline pt-4">
            <div className="flex justify-between py-1.5">
              <dt className="text-sm text-ink-soft">Stops</dt>
              <dd className="tabular text-sm font-bold text-ink">{picked.length}</dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-sm text-ink-soft">Bags</dt>
              <dd className="tabular text-sm font-bold text-ink">{bags}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>

          <Button type="submit" tone="accent" disabled={busy || picked.length === 0} className="mt-4 w-full">
            {busy ? "Creating…" : `Create route with ${picked.length} ${picked.length === 1 ? "stop" : "stops"}`}
          </Button>
          <p className="mt-2 text-xs text-ink-faint">
            Each stop is assigned to this agent and the customer is notified.
          </p>
        </Card>
      </div>
    </form>
  );
}
