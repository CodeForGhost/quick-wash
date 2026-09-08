"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/patterns";
import { api, messageFrom } from "@/lib/client";

/** FR-024 / FR-025: disable or restore an account. */
export function ToggleAccount({ id, active }: { id: number; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/agents/${id}`, { method: "PATCH", json: { is_active: !active } });
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="shrink-0 text-right">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={error || undefined}
        className={cx(
          "rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50",
          active
            ? "border-hairline text-ink-soft hover:border-flag hover:text-flag"
            : "border-flag/30 bg-flag-soft text-flag hover:border-flag",
        )}
      >
        {busy ? "…" : active ? "Disable" : "Disabled - restore"}
      </button>
      {error ? <span className="mt-1 block text-[10px] text-flag">{error}</span> : null}
    </span>
  );
}
