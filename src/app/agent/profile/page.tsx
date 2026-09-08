import { requireRole } from "@/components/app-shell";
import { PageTitle } from "@/components/patterns";
import { getUser } from "@/lib/repos";
import { ProfileForm } from "@/components/profile-form";

export const metadata = { title: "Profile · QuickWash" };

export default async function AgentProfilePage() {
  const session = await requireRole("PICKUP_AGENT");
  const user = getUser(session.id)!;
  return (
    <>
      <PageTitle eyebrow="Your account" title="Profile" subtitle="Customers see this number when they need to reach you." />
      <ProfileForm user={{ name: user.name, phone: user.phone, email: user.email }} />
    </>
  );
}
