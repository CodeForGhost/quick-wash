"use client";

import { useState } from "react";
import { Button, Card, Field, Input, Notice, SectionHeading } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";

const FIELDS = [
  { key: "business_name", label: "Business name", hint: "Shown to customers.", placeholder: "QuickWash" },
  { key: "service_area", label: "Service area", hint: "Where you collect from.", placeholder: "Puttalam" },
  { key: "contact_phone", label: "Contact number", hint: "For customer questions.", placeholder: "032 226 5100" },
  {
    key: "price_per_bag",
    label: "Guide price per bag (LKR)",
    hint: "A starting point for staff. The final price is set per order.",
    placeholder: "600",
  },
] as const;

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const { run, busy, error } = useAction();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((field) => [field.key, settings[field.key] ?? ""])),
  );
  const [saved, setSaved] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaved("");
    void run("save", async () => {
      await api("/api/admin/settings", { method: "PUT", json: values });
      setSaved("Settings saved.");
      return { refresh: true };
    });
  }

  return (
    <Card className="max-w-lg p-5">
      <SectionHeading eyebrow="Business" title="Service details" />
      <form className="space-y-4" onSubmit={submit}>
        {FIELDS.map((field) => (
          <Field key={field.key} label={field.label} hint={field.hint}>
            <Input
              value={values[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
            />
          </Field>
        ))}

        <Notice tone="error">{error}</Notice>
        <Notice tone="success">{saved}</Notice>

        <Button type="submit" loading={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </Card>
  );
}
