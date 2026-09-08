import { handle, ok, readJson } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { createAddress, createUser } from "@/lib/repos";
import { registerSchema } from "@/lib/validation";

/** FR-001: customer registration. An optional first address is saved with it. */
export const POST = handle(async (request: Request) => {
  const input = registerSchema.parse(await readJson(request));

  const user = createUser({
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    password: input.password,
    role: "CUSTOMER",
  });

  if (input.address) {
    createAddress(user.id, {
      label: input.address.label || "Home",
      address: input.address.address,
      area: input.address.area || null,
      landmark: input.address.landmark || null,
      phone: user.phone,
    });
  }

  await createSession(user.id);
  return ok({ id: user.id, name: user.name, role: user.role }, 201);
});
