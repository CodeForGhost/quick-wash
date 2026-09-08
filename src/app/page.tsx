import { redirect } from "next/navigation";
import { HOME_FOR_ROLE, getSessionUser } from "@/lib/auth";

/** Everyone lands on their own section; signed-out visitors get the sign-in page. */
export default async function RootPage() {
  const user = await getSessionUser();
  redirect(user ? HOME_FOR_ROLE[user.role] : "/login");
}
