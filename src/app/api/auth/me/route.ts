import { handle, ok } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const GET = handle(async () => ok(await getSessionUser()));
