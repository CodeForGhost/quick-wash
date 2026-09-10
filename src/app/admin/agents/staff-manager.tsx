"use client";

import { useState } from "react";
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
  Spinner,
  cx,
} from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";

interface Agent {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  is_active: boolean;
  active_pickups: number;
  active_deliveries: number;
  completed: number;
}

interface Staff {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  is_active: boolean;
  shop_id: number | null;
}

/** FR-025 / FR-026: manage the people who run the service. */
export function StaffManager({
  agents,
  staff,
  shops,
}: {
  agents: Agent[];
  staff: Staff[];
  shops: Array<{ id: number; name: string }>;
}) {
  // One screen, many buttons: the key says which one is working, so toggling a
  // single agent does not put the whole roster into a loading state.
  const { run, busy, isBusy, error } = useAction();
  const [role, setRole] = useState<"PICKUP_AGENT" | "SHOP_STAFF">("PICKUP_AGENT");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState("");

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaved("");
    void run("create", async () => {
      await api("/api/admin/agents", {
        method: "POST",
        json: {
          name: form.get("name"),
          phone: form.get("phone"),
          email: form.get("email") || undefined,
          password: form.get("password"),
          role,
          shop_id: role === "SHOP_STAFF" ? Number(form.get("shop_id")) || null : null,
        },
      });
      setSaved(role === "PICKUP_AGENT" ? "Agent added." : "Shop staff added.");
      setOpen(false);
      return { refresh: true };
    });
  }

  function toggle(id: number, isActive: boolean) {
    void run(`toggle:${id}`, async () => {
      await api(`/api/admin/agents/${id}`, { method: "PATCH", json: { is_active: !isActive } });
      return { refresh: true };
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" tone="accent" onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Add someone"}
        </Button>
        <Notice tone="success">{saved}</Notice>
      </div>

      {open ? (
        <Card className="p-5">
          <SectionHeading eyebrow="New account" title="Add an agent or shop staff" />
          <form className="space-y-4" onSubmit={create}>
            <div className="flex gap-2">
              {(
                [
                  ["PICKUP_AGENT", "Pickup agent"],
                  ["SHOP_STAFF", "Shop staff"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  aria-pressed={role === value}
                  className={cx(
                    "rounded-full border px-4 py-2 text-sm font-semibold transition",
                    role === value ? "border-ink bg-ink text-white" : "border-hairline text-ink-soft",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required>
                <Input name="name" placeholder="Kamal Silva" required />
              </Field>
              <Field label="Mobile number" hint="They sign in with this." required>
                <Input name="phone" type="tel" inputMode="tel" placeholder="07X XXX XXXX" required />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" placeholder="Optional" />
              </Field>
              <Field label="Temporary password" hint="At least 6 characters." required>
                <Input name="password" type="text" minLength={6} placeholder="Share this with them" required />
              </Field>
            </div>

            {role === "SHOP_STAFF" ? (
              <Field label="Laundry shop" required>
                <Select name="shop_id" required defaultValue={String(shops[0]?.id ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a shop" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.map((shop) => (
                      <SelectItem key={shop.id} value={String(shop.id)}>
                        {shop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <Notice tone="error">{error}</Notice>

            <Button type="submit" loading={isBusy("create")} disabled={busy}>
              {isBusy("create") ? "Creating…" : "Create account"}
            </Button>
          </form>
        </Card>
      ) : null}

      <section>
        <SectionHeading eyebrow="FR-025" title="Pickup agents" />
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((agent) => (
            <Card key={agent.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{agent.name}</p>
                  <p className="tabular text-xs text-ink-faint">{agent.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(agent.id, agent.is_active)}
                  disabled={busy}
                  aria-busy={isBusy(`toggle:${agent.id}`) || undefined}
                  className={cx(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50 aria-busy:opacity-100",
                    agent.is_active
                      ? "border-hairline text-ink-soft hover:border-flag hover:text-flag"
                      : "border-flag/30 bg-flag-soft text-flag",
                  )}
                >
                  {isBusy(`toggle:${agent.id}`) ? <Spinner aria-hidden data-icon="inline-start" className="size-3 shrink-0" /> : null}
                  {agent.is_active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
              <div className="mt-3 flex gap-5 border-t border-hairline pt-3 text-xs text-ink-soft">
                <span>
                  <span className="tabular block text-lg font-bold text-ink">{agent.active_pickups}</span>
                  to collect
                </span>
                <span>
                  <span className="tabular block text-lg font-bold text-ink">{agent.active_deliveries}</span>
                  to deliver
                </span>
                <span>
                  <span className="tabular block text-lg font-bold text-ink-faint">{agent.completed}</span>
                  completed
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading eyebrow="Counter" title="Shop staff" />
        <Card className="divide-y divide-hairline overflow-hidden">
          {staff.map((member) => (
            <div key={member.id} className="flex items-center gap-4 p-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{member.name}</span>
                <span className="tabular block text-xs text-ink-faint">{member.phone}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-soft">
                {shops.find((shop) => shop.id === member.shop_id)?.name ?? "No shop"}
              </span>
              <button
                type="button"
                onClick={() => toggle(member.id, member.is_active)}
                disabled={busy}
                aria-busy={isBusy(`toggle:${member.id}`) || undefined}
                className={cx(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50 aria-busy:opacity-100",
                  member.is_active
                    ? "border-hairline text-ink-soft hover:border-flag hover:text-flag"
                    : "border-flag/30 bg-flag-soft text-flag",
                )}
              >
                {isBusy(`toggle:${member.id}`) ? <Spinner aria-hidden data-icon="inline-start" className="size-3 shrink-0" /> : null}
                {member.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          ))}
        </Card>
      </section>

      <Notice tone="error">{error}</Notice>
    </div>
  );
}
