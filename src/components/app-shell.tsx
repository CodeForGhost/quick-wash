import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { unreadCount } from "@/lib/notifications";
import type { Role, SessionUser } from "@/lib/types";
import { TabBar, TopBar, type NavItem } from "./nav";

/** SRS section 13: the screens each role can reach. */
export const NAV: Record<Role, NavItem[]> = {
  CUSTOMER: [
    { href: "/customer", label: "Home", icon: "home" },
    { href: "/customer/orders", label: "My orders", short: "Orders", icon: "orders" },
    { href: "/customer/addresses", label: "Addresses", short: "Places", icon: "places" },
    { href: "/customer/profile", label: "Profile", icon: "profile" },
  ],
  PICKUP_AGENT: [
    { href: "/agent", label: "Pickups", icon: "pickups" },
    { href: "/agent/deliveries", label: "Deliveries", short: "Drop-offs", icon: "deliveries" },
    { href: "/agent/profile", label: "Profile", icon: "profile" },
  ],
  SHOP_STAFF: [
    { href: "/shop", label: "Counter", icon: "counter" },
    { href: "/shop/processing", label: "Processing", short: "In wash", icon: "washing" },
    { href: "/shop/ready", label: "Ready", icon: "ready" },
    { href: "/shop/history", label: "History", icon: "history" },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview", icon: "overview" },
    { href: "/admin/orders", label: "Orders", icon: "orders" },
    { href: "/admin/customers", label: "Customers", icon: "customers" },
    { href: "/admin/agents", label: "Agents", icon: "agents" },
    { href: "/admin/shops", label: "Shops", icon: "shops" },
    { href: "/admin/reports", label: "Reports", icon: "reports" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
  ],
};

/** Roles that spend the day on a phone get the bottom tab bar. */
const TAB_BAR_ROLES: Role[] = ["CUSTOMER", "PICKUP_AGENT", "SHOP_STAFF"];

/**
 * Guards a role's section and renders the chrome around it. Every page under
 * /customer, /agent, /shop and /admin goes through here, so an unauthenticated
 * or wrong-role visitor never reaches the content.
 */
export async function AppShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const user = await requireRole(role);
  const items = NAV[role];
  const showTabs = TAB_BAR_ROLES.includes(role);

  return (
    <div className="min-h-svh">
      <TopBar user={user} items={items} unread={await unreadCount(user.id)} />
      <main className={showTabs ? "gutter mx-auto max-w-6xl py-6 pb-28 md:pb-10" : "gutter mx-auto max-w-6xl py-6 pb-10"}>
        {children}
      </main>
      {showTabs ? <TabBar items={items} /> : null}
    </div>
  );
}

/** Sends a signed-out visitor to the login page and a wrong role to their own. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(HOME[user.role]);
  return user;
}

export const HOME: Record<Role, string> = {
  CUSTOMER: "/customer",
  PICKUP_AGENT: "/agent",
  SHOP_STAFF: "/shop",
  ADMIN: "/admin",
};
