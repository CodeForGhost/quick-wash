import { fail, handle, ok, readJson } from "@/lib/api";
import { signIn, signUpCustomer } from "@/lib/auth";
import { createAddress } from "@/lib/repos";
import { registerSchema } from "@/lib/validation";

/** FR-001: customer registration. An optional first address is saved with it. */
export const POST = handle(async (request: Request) => {
  const input = registerSchema.parse(await readJson(request));

  const created = await signUpCustomer({
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    password: input.password,
  });
  if (!created.ok) return fail(created.error, 409);

  // Sign in before writing the address: row level security only lets you add
  // to your own address book, so this has to run as the new customer.
  const user = await signIn(input.phone, input.password);
  if (!user) return fail("Your account was created. Please sign in.", 201);

  if (input.address) {
    await createAddress(user.id, {
      label: input.address.label || "Home",
      address: input.address.address,
      area: input.address.area || null,
      landmark: input.address.landmark || null,
      phone: user.phone,
    });
  }

  return ok({ id: user.id, name: user.name, role: user.role }, 201);
});
