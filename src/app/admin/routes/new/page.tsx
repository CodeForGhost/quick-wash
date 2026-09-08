import Link from "next/link";
import { requireRole } from "@/components/app-shell";
import { EmptyState, PageTitle } from "@/components/patterns";
import { listOrders } from "@/lib/orders";
import { listAgentsWithWorkload } from "@/lib/repos";
import { RoutePlanner } from "./route-planner";

export const metadata = { title: "Plan a route · QuickWash" };

/** FR-022: choose an agent, a day, and the stops that belong together. */
export default async function NewRoutePage() {
  await requireRole("ADMIN");

  // Only orders that have not been collected yet can join a round.
  const candidates = listOrders({ statuses: ["PENDING", "PICKUP_ASSIGNED"] });
  const agents = listAgentsWithWorkload().filter((agent) => agent.is_active);

  return (
    <>
      <Link href="/admin/routes" className="mb-4 inline-block text-sm font-semibold text-lagoon">
        ← Pickup routes
      </Link>

      <PageTitle
        eyebrow="New route"
        title="Plan a pickup round"
        subtitle="Tick the stops that sit near each other. They are numbered in the order you tick them."
      />

      {candidates.length === 0 ? (
        <EmptyState
          title="No pickups to batch"
          body="Every requested pickup has already been collected. New requests will appear here."
        />
      ) : agents.length === 0 ? (
        <EmptyState
          title="No pickup agent is currently available."
          body="Add an active pickup agent before planning a route."
        />
      ) : (
        <RoutePlanner
          orders={candidates.map((order) => ({
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customer_name,
            bag_count: order.bag_count,
            area: order.address_area,
            address: order.address_line,
            pickup_date: order.pickup_date,
            time_slot: order.pickup_time_slot,
            assigned_to: order.pickup_agent_name,
          }))}
          agents={agents.map((agent) => ({ id: agent.id, name: agent.name, load: agent.active_pickups }))}
        />
      )}
    </>
  );
}
