import { handle, ok } from "@/lib/api";
import { signOut } from "@/lib/auth";

export const POST = handle(async () => {
  await signOut();
  return ok({ signedOut: true });
});
