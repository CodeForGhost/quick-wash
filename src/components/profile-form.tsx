"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Input, Notice } from "@/components/patterns";
import { api, messageFrom } from "@/lib/client";

/** FR-003: view and edit your own profile. */
export function ProfileForm({ user }: { user: { name: string; phone: string; email: string | null } }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await api("/api/customers/profile", { method: "PUT", json: { name, phone, email } });
      setSaved("Profile saved.");
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-lg p-5">
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Full name" required>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>

        <Field label="Mobile number" hint="You sign in with this number." required>
          <Input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </Field>

        <Field label="Email" hint="Optional.">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>

        <Notice tone="error">{error}</Notice>
        <Notice tone="success">{saved}</Notice>

        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
