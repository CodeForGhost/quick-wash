"use client";

import { useState } from "react";
import { Button, Card, EmptyState, Notice, SectionHeading, cx } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";

interface AgentOption {
  id: number;
  name: string;
  phone: string;
  load: number;
}

/**
 * FR-007 / FR-016 (BR-003): only an administrator assigns agents. Each agent
 * shows their current load, so the round can be spread sensibly.
 */
export function AssignAgent({
  orderId,
  type,
  agents,
  current,
}: {
  orderId: number;
  type: "pickup" | "delivery";
  agents: AgentOption[];
  current: number | null;
}) {
  const { run, busy, error } = useAction();
  const [selected, setSelected] = useState(current ?? agents[0]?.id ?? 0);

  function assign() {
    void run("assign", async () => {
      await api(`/api/admin/orders/${orderId}/assign-agent`, {
        method: "POST",
        json: { agent_id: selected, type },
      });
      // Assigning also notifies the customer; hold the button until the order
      // page comes back showing who it went to.
      return { refresh: true };
    });
  }

  const heading = type === "pickup" ? "Assign a pickup agent" : "Assign a delivery agent";
  const action = current
    ? type === "pickup"
      ? "Change pickup agent"
      : "Change delivery agent"
    : type === "pickup"
      ? "Assign and notify"
      : "Send out for delivery";

  return (
    <Card className="p-5">
      <SectionHeading eyebrow={type === "pickup" ? "FR-007" : "FR-016"} title={heading} />

      {agents.length === 0 ? (
        <EmptyState
          title="No pickup agent is currently available."
          body="Add an active agent before assigning this order."
        />
      ) : (
        <>
          <div className="space-y-2">
            {agents.map((agent) => (
              <label
                key={agent.id}
                className={cx(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition",
                  selected === agent.id ? "border-lagoon bg-lagoon-soft/50" : "border-hairline hover:border-ink-faint",
                )}
              >
                <input
                  type="radio"
                  name="agent"
                  className="size-4 shrink-0"
                  checked={selected === agent.id}
                  onChange={() => setSelected(agent.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">
                    {agent.name}
                    {current === agent.id ? (
                      <span className="ml-2 text-xs font-medium text-lagoon">assigned</span>
                    ) : null}
                  </span>
                  <span className="tabular block text-xs text-ink-faint">{agent.phone}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-ink-soft">
                  <span className="tabular block text-base font-bold text-ink">{agent.load}</span>
                  {type === "pickup" ? "to collect" : "to deliver"}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>

          <Button
            type="button"
            tone="accent"
            onClick={assign}
            loading={busy}
            disabled={!selected}
            className="mt-4 w-full"
          >
            {busy ? "Assigning…" : action}
          </Button>
        </>
      )}
    </Card>
  );
}
