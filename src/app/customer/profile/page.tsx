import { requireRole } from "@/components/app-shell";
import { PageTitle } from "@/components/patterns";
import { getUser } from "@/lib/repos";
import { ProfileForm } from "@/components/profile-form";

export const metadata = { title: "Profile · QuickWash" };

/** SRS 13.1 screen 10 / FR-003. */
export default async function CustomerProfilePage() {
  const session = await requireRole("CUSTOMER");
  const user = (await getUser(session.id))!;
  return (
    <>
      <PageTitle eyebrow="Your account" title="Profile" subtitle="Keep your number current so the agent can reach you." />
      <ProfileForm user={{ name: user.name, phone: user.phone, email: user.email }} />
    </>
  );
}
