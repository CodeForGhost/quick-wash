"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * A tap on a link that loads a server-rendered page can sit silent for a
 * second on a phone, and the second tap is the one that makes people think the
 * screen is broken. This renders nothing until the navigation it sits inside is
 * actually pending, so it costs nothing on a fast connection.
 *
 * It must be a descendant of the `<Link>` it reports on.
 */
export function LinkSpinner({ className, ...props }: React.ComponentProps<typeof Spinner>) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  // Nothing else here announces the wait, so the spinner keeps the `role="status"`
  // and "Loading" label it ships with.
  return <Spinner className={cn("shrink-0", className)} {...props} />;
}
