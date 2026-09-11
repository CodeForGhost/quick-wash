"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";
import { Button, Field, Input, Notice, Spinner } from "@/components/patterns";
import type { Role } from "@/lib/types";

const HOME: Record<Role, string> = {
  CUSTOMER: "/customer",
  PICKUP_AGENT: "/agent",
  SHOP_STAFF: "/shop",
  ADMIN: "/admin",
};

/** The accounts created by `npm run db:seed`, offered as one-tap sign-ins. */
const DEMO = [
  { label: "Customer", phone: "0771111111" },
  { label: "Agent", phone: "0770000003" },
  { label: "Shop", phone: "0770000002" },
  { label: "Admin", phone: "0770000001" },
];

export function LoginForm() {
  const { run, busy, isBusy, error } = useAction();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  /**
   * `key` is the control that was pressed - the form, or one of the demo
   * chips - so only that one spins while the sign-in lands and the role's
   * home screen is fetched.
   */
  function signIn(key: string, withPhone: string, withPassword: string) {
    return run(key, async () => {
      const user = await api<{ role: Role }>("/api/auth/login", {
        method: "POST",
        json: { phone: withPhone, password: withPassword },
      });
      return { replace: HOME[user.role], refresh: true };
    });
  }

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn("form", phone, password);
        }}
      >
        <Field label="Mobile number" required>
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            placeholder="07X XXX XXXX"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </Field>

        <Field label="Password" required>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>

        <Notice tone="error">{error}</Notice>

        <Button type="submit" loading={isBusy("form")} disabled={busy} className="w-full">
          {isBusy("form") ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-8 rounded-card border border-dashed border-hairline p-4">
        <p className="eyebrow">Demo accounts</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map((account) => (
            <button
              key={account.phone}
              type="button"
              disabled={busy}
              aria-busy={isBusy(`demo:${account.phone}`) || undefined}
              onClick={() => {
                setPhone(account.phone);
                setPassword("password123");
                void signIn(`demo:${account.phone}`, account.phone, "password123");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-lagoon hover:text-lagoon disabled:opacity-50 aria-busy:border-lagoon aria-busy:text-lagoon aria-busy:opacity-100"
            >
              {isBusy(`demo:${account.phone}`) ? <Spinner aria-hidden data-icon="inline-start" className="size-3 shrink-0" /> : null}
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
