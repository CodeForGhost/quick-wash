"use client";

import { useState } from "react";
import { Button, Card, Field, Input, Notice } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";

/** FR-003: view and edit your own profile. */
export function ProfileForm({ user }: { user: { name: string; phone: string; email: string | null } }) {
  const { run, busy, error } = useAction();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email ?? "");
  const [saved, setSaved] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaved("");
    void run("save", async () => {
      await api("/api/customers/profile", { method: "PUT", json: { name, phone, email } });
      setSaved("Profile saved.");
      return { refresh: true };
    });
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

        <Button type="submit" loading={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
