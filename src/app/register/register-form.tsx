"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, messageFrom } from "@/lib/client";
import { Button, Field, Input, Notice, Textarea } from "@/components/patterns";

/** FR-001: registration, with the first pickup address captured up front. */
export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const addressText = String(form.get("address") ?? "").trim();

    setBusy(true);
    setError("");
    try {
      await api("/api/auth/register", {
        method: "POST",
        json: {
          name: form.get("name"),
          phone: form.get("phone"),
          email: form.get("email") || undefined,
          password: form.get("password"),
          address: addressText
            ? {
                label: "Home",
                address: addressText,
                area: String(form.get("area") ?? ""),
                landmark: String(form.get("landmark") ?? ""),
              }
            : undefined,
        },
      });
      router.replace("/customer");
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause));
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Full name" required>
        <Input name="name" autoComplete="name" placeholder="Ahmed Nazeer" required />
      </Field>

      <Field label="Mobile number" hint="This is how the agent will reach you." required>
        <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="07X XXX XXXX" required />
      </Field>

      <Field label="Email" hint="Optional.">
        <Input name="email" type="email" autoComplete="email" placeholder="you@example.com" />
      </Field>

      <Field label="Password" hint="At least 6 characters." required>
        <Input name="password" type="password" autoComplete="new-password" minLength={6} required />
      </Field>

      <fieldset className="rounded-card border border-hairline p-4">
        <legend className="px-1.5 text-sm font-semibold text-ink">Pickup address</legend>
        <p className="mb-3 text-xs text-ink-faint">Optional now - you can add it before your first pickup.</p>
        <div className="space-y-3">
          <Field label="Address">
            <Textarea name="address" rows={2} placeholder={"No. 25,\nMain Street, Puttalam"} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Area">
              <Input name="area" placeholder="Puttalam Town" />
            </Field>
            <Field label="Landmark">
              <Input name="landmark" placeholder="Near Zahira College" />
            </Field>
          </div>
        </div>
      </fieldset>

      <Notice tone="error">{error}</Notice>

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
