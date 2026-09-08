"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, messageFrom } from "@/lib/client";
import { Button, Field, Input, Notice } from "@/components/patterns";
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
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(withPhone: string, withPassword: string) {
    setBusy(true);
    setError("");
    try {
      const user = await api<{ role: Role }>("/api/auth/login", {
        method: "POST",
        json: { phone: withPhone, password: withPassword },
      });
      router.replace(HOME[user.role]);
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause));
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn(phone, password);
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

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-8 rounded-card border border-dashed border-hairline p-4">
        <p className="eyebrow">Demo accounts</p>
        <p className="mt-1.5 text-xs text-ink-soft">
          Seeded by <span className="tabular">npm run db:seed</span>. Every one uses the password{" "}
          <span className="tabular">password123</span>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map((account) => (
            <button
              key={account.phone}
              type="button"
              disabled={busy}
              onClick={() => {
                setPhone(account.phone);
                setPassword("password123");
                void signIn(account.phone, "password123");
              }}
              className="rounded-full border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-lagoon hover:text-lagoon disabled:opacity-50"
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
