import { AppShell } from "@/components/app-shell";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="PICKUP_AGENT">{children}</AppShell>;
}
