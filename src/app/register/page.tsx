import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";
import { AuthLayout } from "@/components/auth-layout";
import { HOME_FOR_ROLE, getSessionUser } from "@/lib/auth";

export const metadata = { title: "Create an account · QuickWash" };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect(HOME_FOR_ROLE[user.role]);

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Two minutes, and your first pickup can be tomorrow morning."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-lagoon underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
}
