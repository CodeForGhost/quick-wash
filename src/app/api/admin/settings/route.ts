import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { allSettings, setSetting } from "@/lib/repos";

/** Basic system settings for the admin screen. */
export const GET = handle(async () => {
  await requireUser("ADMIN");
  return ok(allSettings());
});

export const PUT = handle(async (request: Request) => {
  await requireUser("ADMIN");
  const body = (await readJson(request)) as Record<string, unknown>;
  for (const [key, value] of Object.entries(body ?? {})) {
    if (typeof value === "string" && key.length <= 60) setSetting(key, value.slice(0, 200));
  }
  return ok(allSettings());
});
