import { AppShell } from "@/components/app-shell";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="SHOP_STAFF">{children}</AppShell>;
}
