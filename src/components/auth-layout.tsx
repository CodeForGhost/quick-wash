import Link from "next/link";
import type { ReactNode } from "react";
import { WashMark } from "./nav";

/**
 * The signed-out frame. The left panel states what the service does in the
 * plainest terms, using the same rail language as the tracking screen.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink px-10 py-12 text-white lg:flex">
        {/* Salt-pan grid: the rectangular evaporation pans north of Puttalam. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "72px 48px",
          }}
        />
        <Link href="/" className="relative flex items-center gap-3">
          <WashMark className="size-8" />
          <span className="font-display text-lg font-bold tracking-tighter">QuickWash</span>
        </Link>

        <div className="relative max-w-md">
          <p className="eyebrow text-white/50">Pickup and delivery in Puttalam</p>
          <h2 className="mt-4 font-display tracking-tighter text-4xl font-bold leading-[1.1]">
            Leave the bag at your door. We handle the rest.
          </h2>
          <ol className="mt-10 space-y-0">
            {[
              ["You request", "Pick a day, a time and how many bags."],
              ["We collect", "An agent picks up several homes on one round."],
              ["The shop washes", "You see each step as it happens."],
              ["We bring it back", "Clean, pressed, at your door."],
            ].map(([step, detail], index, list) => (
              <li key={step} className="relative flex gap-4 pb-7 last:pb-0">
                {index < list.length - 1 ? (
                  <span aria-hidden className="absolute left-[11px] top-6 h-full w-px bg-white/25" />
                ) : null}
                <span
                  aria-hidden
                  className="tabular relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-lagoon text-[11px] font-bold"
                >
                  {index + 1}
                </span>
                <span>
                  <span className="block font-semibold">{step}</span>
                  <span className="block text-sm text-white/60">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-xs text-white/40">Serving Puttalam town and nearby areas.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <WashMark />
            <span className="font-display text-base font-bold tracking-tighter text-ink">QuickWash</span>
          </Link>

          <h1 className="font-display text-3xl font-bold tracking-tighter text-ink">{title}</h1>
          <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <div className="mt-6 text-sm text-ink-soft">{footer}</div>
        </div>
      </main>
    </div>
  );
}
