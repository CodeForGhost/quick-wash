import { requireRole } from "@/components/app-shell";
import { PageTitle } from "@/components/patterns";
import { allSettings } from "@/lib/repos";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings · QuickWash" };

/** SRS 13.4 screen 8: basic system settings. */
export default async function AdminSettingsPage() {
  await requireRole("ADMIN");
  return (
    <>
      <PageTitle
        eyebrow="System"
        title="Settings"
        subtitle="The details customers see and the guide price staff work from."
      />
      <SettingsForm settings={allSettings()} />
    </>
  );
}
