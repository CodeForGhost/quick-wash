"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Bike,
  ChartColumn,
  History,
  House,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  PackageCheck,
  ScanLine,
  Settings,
  Store,
  Truck,
  User,
  Users,
  WashingMachine,
  type LucideIcon,
} from "lucide-react";
import type { SessionUser } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Nav icons are named rather than passed as components: `NAV` is declared in a
 * server module, and a component reference cannot cross that boundary.
 */
const ICONS = {
  home: House,
  orders: Package,
  places: MapPin,
  profile: User,
  pickups: Package,
  deliveries: Truck,
  counter: ScanLine,
  washing: WashingMachine,
  ready: PackageCheck,
  history: History,
  overview: LayoutDashboard,
  customers: Users,
  agents: Bike,
  shops: Store,
  reports: ChartColumn,
  settings: Settings,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  /** Short label for the mobile tab bar, where space is tight. */
  short?: string;
  icon: NavIcon;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/customer" || href === "/agent" || href === "/shop" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function TopBar({
  user,
  items,
  unread,
}: {
  user: SessionUser;
  items: NavItem[];
  unread: number;
}) {
  const pathname = usePathname();
  const { run, busy } = useAction();

  function signOut() {
    void run("sign-out", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      return { replace: "/login", refresh: true };
    });
  }

  return (
    <header className="sticky-bar sticky top-0 z-30 border-b border-hairline bg-surface/95 backdrop-blur">
      <div className="gutter mx-auto flex max-w-6xl items-center gap-4 py-3">
        <Link href={items[0]?.href ?? "/"} className="flex items-center gap-2.5">
          <WashMark />
          <span className="font-display text-[17px] font-extrabold leading-none tracking-tighter text-ink">
            QuickWash
            <span className="mt-0.5 block text-[11px] font-medium tracking-normal text-ink-faint">
              Puttalam
            </span>
          </span>
        </Link>

        <nav aria-label="Sections" className="ml-4 hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                isActive(pathname, item.href)
                  ? "bg-ink text-white"
                  : "text-ink-soft hover:bg-ground hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/notifications"
            className="relative rounded-full border border-hairline px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:border-ink-faint hover:text-ink"
          >
            Updates
            {unread > 0 ? (
              <Badge className="tabular absolute -top-1.5 -right-1.5 min-w-5 bg-lagoon px-1.5 py-0.5 text-[10px] leading-none font-bold text-white">
                {unread > 99 ? "99+" : unread}
                <span className="sr-only"> unread updates</span>
              </Badge>
            ) : null}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Account menu for ${user.name}`}
              className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-bold text-white outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span aria-hidden>{user.name.charAt(0).toUpperCase()}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="grid gap-0.5">
                <span className="truncate text-sm font-semibold text-ink">{user.name}</span>
                <span className="tabular truncate text-xs font-normal text-ink-faint">{user.phone}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(pathname, item.href);
                return (
                  <DropdownMenuItem key={item.href} asChild className="md:hidden">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={active ? "font-semibold text-lagoon" : undefined}
                    >
                      <Icon aria-hidden className={active ? "text-lagoon" : undefined} />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator className="md:hidden" />
              <DropdownMenuItem
                variant="destructive"
                aria-busy={busy || undefined}
                onSelect={(event) => {
                  // Hold the menu open so the spinner is somewhere the person
                  // can still see it while the session is being cleared.
                  event.preventDefault();
                  signOut();
                }}
              >
                {busy ? <Spinner aria-hidden /> : <LogOut aria-hidden />}
                {busy ? "Signing out…" : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

/** Bottom tab bar for the roles that work from a phone. */
export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="sticky-bar fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = ICONS[item.icon];
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors",
                  active ? "text-lagoon" : "text-ink-faint hover:text-ink-soft",
                )}
              >
                {/* The lozenge is the active marker; the icon carries no meaning alone. */}
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active ? "bg-lagoon-soft" : "bg-transparent",
                  )}
                >
                  <TabIcon icon={Icon} active={active} />
                </span>
                {item.short ?? item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}

/**
 * The tab's own icon, replaced by a spinner while the page behind that tab is
 * being fetched. Swapping in place keeps the tab bar from moving, and answers
 * the tap on the slow connections these rounds are worked on.
 */
function TabIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return <Spinner className="size-[18px] text-lagoon" />;
  }
  return <Icon aria-hidden className="size-[18px]" strokeWidth={active ? 2.25 : 2} />;
}

/**
 * The mark: three stacked lines that read both as folded laundry and as the
 * salt pans the town is known for.
 */
export function WashMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="24" height="24" rx="7" fill="#16243f" />
      <path d="M6 8.5h12M6 12h12M6 15.5h7" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="16.5" cy="15.5" r="1.75" fill="#0e7c7b" />
    </svg>
  );
}
