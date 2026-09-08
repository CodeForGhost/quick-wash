import { requireRole } from "@/components/app-shell";
import { PageTitle } from "@/components/patterns";
import { listAgentsWithWorkload, listShops, listUsers } from "@/lib/repos";
import { StaffManager } from "./staff-manager";

export const metadata = { title: "Agents · QuickWash" };

/** FR-025: create, edit and deactivate agents and shop staff. */
export default async function AdminAgentsPage() {
  await requireRole("ADMIN");

  const agents = await listAgentsWithWorkload();
  const staff = await listUsers("SHOP_STAFF");
  const shops = await listShops();

  return (
    <>
      <PageTitle
        eyebrow="Your team"
        title="Agents and staff"
        subtitle="Pickup agents collect and deliver. Shop staff run the laundry counter."
      />
      <StaffManager
        agents={agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          phone: agent.phone,
          email: agent.email,
          is_active: Boolean(agent.is_active),
          active_pickups: agent.active_pickups,
          active_deliveries: agent.active_deliveries,
          completed: agent.completed,
        }))}
        staff={staff.map((member) => ({
          id: member.id,
          name: member.name,
          phone: member.phone,
          email: member.email,
          is_active: Boolean(member.is_active),
          shop_id: member.shop_id,
        }))}
        shops={shops.map((shop) => ({ id: shop.id, name: shop.name }))}
      />
    </>
  );
}
