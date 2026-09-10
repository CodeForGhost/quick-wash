import Link from "next/link";
import { WashMark } from "@/components/nav";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 text-center">
      <WashMark className="size-10" />
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tighter text-ink">This page is not here</h1>
      <p className="mt-2 max-w-sm text-ink-soft">
        The order or page you tried to open does not exist, or is not yours to view.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90"
      >
        Go to your home page
      </Link>
    </div>
  );
}
