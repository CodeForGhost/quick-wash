import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { updateShop } from "@/lib/repos";
import { shopSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export const PUT = handle(async (request: Request, { params }: Params) => {
  await requireUser("ADMIN");
  const { id } = await params;
  const input = shopSchema.parse(await readJson(request));
  return ok(await updateShop(Number(id), input));
});
