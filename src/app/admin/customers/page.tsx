import Link from "next/link";
import { requireRole } from "@/components/app-shell";
import { Card, EmptyState, Figure, PageTitle } from "@/components/patterns";
import { formatDate, formatPrice } from "@/lib/format";
import { listCustomers } from "@/lib/repos";
import { ToggleAccount } from "./toggle-account";

export const metadata = { title: "Customers · QuickWash" };

/** FR-024: customer management. */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole("ADMIN");
  const { q } = await searchParams;
  const customers = await listCustomers(q || undefined);

  const repeat = customers.filter((customer) => customer.order_count > 1).length;
  const spend = customers.reduce((total, customer) => total + (customer.total_spend ?? 0), 0);

  return (
    <>
      <PageTitle eyebrow="People" title="Customers" subtitle="Everyone registered, with what they have ordered." />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Figure value={customers.length} label="Registered" />
        <Figure value={repeat} label="Ordered more than once" tone="lagoon" />
        <Figure value={formatPrice(spend)} label="Billed to customers" />
      </div>

      <form className="mb-5 flex gap-2" action="/admin/customers">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or phone"
          className="min-w-56 flex-1 rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-lagoon focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90"
        >
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <EmptyState
          title="No customers match"
          body="Clear the search to see everyone who has registered."
        />
      ) : (
        <Card className="divide-y divide-hairline overflow-hidden">
          {customers.map((customer) => (
            <div key={customer.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <Link href={`/admin/customers/${customer.id}`} className="min-w-40 flex-1">
                <span className="block truncate font-medium text-ink">{customer.name}</span>
                <span className="tabular block truncate text-xs text-ink-faint">{customer.phone}</span>
              </Link>
              <span className="w-24 shrink-0 text-sm text-ink-soft">
                <span className="tabular font-semibold text-ink">{customer.order_count}</span> orders
              </span>
              <span className="tabular w-28 shrink-0 text-sm text-ink-soft">
                {formatPrice(customer.total_spend ?? 0)}
              </span>
              <span className="hidden w-28 shrink-0 text-xs text-ink-faint sm:block">
                {customer.last_order_at ? formatDate(customer.last_order_at) : "No orders"}
              </span>
              <ToggleAccount id={customer.id} active={Boolean(customer.is_active)} />
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
