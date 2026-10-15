import { useEffect, useState } from "react";

type InvoiceStatus = "paid" | "pending" | "overdue" | "draft" | "void";

interface Invoice {
  id: string;
  customer: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
}

interface Stats {
  mrr: number;
  activeCustomers: number;
  churnRate: number; // percentage, e.g. 2.4
  recentInvoices: Invoice[];
}

const statusStyles: Record<InvoiceStatus, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  overdue: "bg-red-100 text-red-800",
  draft: "bg-gray-100 text-gray-700",
  void: "bg-gray-100 text-gray-500",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-2 text-3xl font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/stats", { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        setStats((await res.json()) as Stats);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div
        role="status"
        className="flex min-h-[200px] items-center justify-center text-gray-500"
      >
        <svg
          className="mr-3 h-5 w-5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        Loading dashboard…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
      >
        <p className="font-medium">Couldn't load dashboard stats</p>
        <p className="mt-1 text-sm">{error ?? "No data returned."}</p>
      </div>
    );
  }

  const invoices = (stats.recentInvoices ?? []).slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Ledgerly Dashboard</h1>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Monthly recurring revenue"
          value={currency.format(stats.mrr)}
        />
        <StatCard
          label="Active customers"
          value={stats.activeCustomers.toLocaleString("en-US")}
        />
        <StatCard
          label="Churn rate"
          value={`${stats.churnRate.toFixed(1)}%`}
        />
      </dl>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Recent invoices
        </h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Amount
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Due date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No invoices yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {inv.customer}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {currency.format(inv.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          statusStyles[inv.status] ?? statusStyles.draft
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(inv.dueDate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
