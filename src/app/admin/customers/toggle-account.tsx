"use client";

import { Spinner, cx } from "@/components/patterns";
import { api } from "@/lib/client";
import { useAction } from "@/lib/use-action";

/** FR-024 / FR-025: disable or restore an account. */
export function ToggleAccount({ id, active }: { id: number; active: boolean }) {
  const { run, busy, error } = useAction();

  function toggle() {
    void run("toggle", async () => {
      await api(`/api/admin/agents/${id}`, { method: "PATCH", json: { is_active: !active } });
      // The row's own label flips on the refresh, so that is when this is done.
      return { refresh: true };
    });
  }

  return (
    <span className="shrink-0 text-right">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-busy={busy || undefined}
        title={error || undefined}
        className={cx(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50 aria-busy:opacity-100",
          active
            ? "border-hairline text-ink-soft hover:border-flag hover:text-flag"
            : "border-flag/30 bg-flag-soft text-flag hover:border-flag",
        )}
      >
        {busy ? <Spinner aria-hidden data-icon="inline-start" className="size-3 shrink-0" /> : null}
        {busy ? (active ? "Disabling…" : "Restoring…") : active ? "Disable" : "Disabled - restore"}
      </button>
      {error ? <span className="mt-1 block text-[10px] text-flag">{error}</span> : null}
    </span>
  );
}
