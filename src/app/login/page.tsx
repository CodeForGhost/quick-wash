import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { AuthLayout } from "@/components/auth-layout";
import { HOME_FOR_ROLE, getSessionUser } from "@/lib/auth";

export const metadata = { title: "Sign in · QuickWash" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(HOME_FOR_ROLE[user.role]);

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use the mobile number you registered with."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-semibold text-lagoon underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
