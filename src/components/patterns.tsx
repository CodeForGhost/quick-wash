import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { STATUS_TONE } from "@/lib/format";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button as ShadButton } from "@/components/ui/button";
import { Card as ShadCard } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { LinkSpinner } from "./pending";

/**
 * QuickWash screen patterns, composed from the shadcn/ui primitives in
 * `components/ui`. Pages import from here; they never restyle a primitive.
 */

export { cn as cx } from "@/lib/utils";
export { Field, Input, SelectTrigger, Textarea } from "./field";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectValue,
} from "@/components/ui/select";
export { Skeleton } from "@/components/ui/skeleton";
export { Spinner } from "@/components/ui/spinner";
export { Separator } from "@/components/ui/separator";
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Surfaces ----------------------------------------------------------------

/**
 * The shadcn card, with its own vertical rhythm switched off: QuickWash screens
 * set their own padding, and several cards are edge-to-edge lists.
 */
export function Card({ className, children, ...props }: ComponentProps<typeof ShadCard>) {
  return (
    <ShadCard className={cn("gap-0 rounded-card border-hairline py-0 shadow-none", className)} {...props}>
      {children}
    </ShadCard>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="font-display text-xl font-semibold tracking-tighter text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function PageTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
      <h1 className="font-display text-3xl font-bold tracking-tighter text-ink sm:text-4xl">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-prose text-ink-soft">{subtitle}</p> : null}
    </div>
  );
}

/** An empty screen is an invitation to act, so it always carries the next step. */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-hairline bg-surface/60 px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold tracking-tighter text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// --- Status ------------------------------------------------------------------

export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent px-2.5 py-1 font-semibold ring-1 ring-inset", STATUS_TONE[status], className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

// --- Controls ----------------------------------------------------------------

const TONE_VARIANT = {
  primary: "default",
  accent: "accent",
  quiet: "outline",
  danger: "danger",
} as const;

export type ButtonTone = keyof typeof TONE_VARIANT;

/* Pills, at 44px, are the QuickWash button shape everywhere. */
const BUTTON_SHAPE = "h-11 rounded-full px-5 text-sm font-semibold";

/**
 * `loading` is the one way a button says it is working: a spinner, `aria-busy`
 * for anyone listening, and no second submit. Pair it with a label that names
 * the work ("Saving…") - the spinner says something is happening, the label
 * says what.
 */
export function Button({
  tone = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof ShadButton>, "variant"> & { tone?: ButtonTone; loading?: boolean }) {
  return (
    <ShadButton
      variant={TONE_VARIANT[tone]}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        BUTTON_SHAPE,
        tone === "quiet" && "border-hairline text-ink hover:bg-ground hover:text-ink",
        // A working button is not a dead one: hold it at full strength so the
        // spinner reads as progress rather than as a control that switched off.
        loading && "disabled:opacity-100",
        className,
      )}
      {...props}
    >
      {loading ? <Spinner aria-hidden data-icon="inline-start" /> : null}
      {children}
    </ShadButton>
  );
}

/**
 * A link shaped like a button. It spins while the page it points at is being
 * fetched, so a call to action on a phone answers the tap rather than waiting
 * silently for the new screen.
 */
export function ButtonLink({
  tone = "primary",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { tone?: ButtonTone }) {
  return (
    <ShadButton
      asChild
      variant={TONE_VARIANT[tone]}
      className={cn(BUTTON_SHAPE, tone === "quiet" && "border-hairline text-ink hover:bg-ground hover:text-ink", className)}
    >
      <Link {...props}>
        <LinkSpinner data-icon="inline-start" />
        {children}
      </Link>
    </ShadButton>
  );
}

/** Inline form feedback. Errors say what happened; they never apologise. */
export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  if (!children) return null;
  const isError = tone === "error";
  return (
    <Alert
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn(
        "rounded-xl border-transparent py-2.5",
        isError ? "bg-flag-soft text-flag" : "bg-lagoon-soft text-lagoon-deep",
      )}
    >
      {isError ? <CircleAlert aria-hidden /> : <CircleCheck aria-hidden />}
      <AlertDescription className="text-sm font-medium text-current">{children}</AlertDescription>
    </Alert>
  );
}

// --- Data display ------------------------------------------------------------

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-hairline py-2.5 last:border-0">
      <dt className="shrink-0 text-sm text-ink-soft">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

/** A count with its label. Used across the operational dashboards. */
export function Figure({
  value,
  label,
  tone = "ink",
  href,
}: {
  value: ReactNode;
  label: string;
  tone?: "ink" | "lagoon" | "sun";
  href?: string;
}) {
  const body = (
    <>
      <span
        className={cn(
          "font-display text-3xl font-bold leading-none tracking-tighter tabular-nums",
          tone === "lagoon" && "text-lagoon",
          tone === "sun" && "text-sun",
          tone === "ink" && "text-ink",
        )}
      >
        {value}
      </span>
      <span className="mt-2 block text-xs font-medium text-ink-soft">{label}</span>
    </>
  );
  return href ? (
    <Card className="transition hover:border-ink-faint">
      <Link href={href} className="block px-4 py-4">
        {body}
      </Link>
    </Card>
  ) : (
    <Card>
      <div className="px-4 py-4">{body}</div>
    </Card>
  );
}
