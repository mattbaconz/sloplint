import { useCallback, useEffect, useState } from "react";

type InvoiceStatus = "paid" | "pending" | "overdue";

interface Invoice {
  id: string;
  customer: string;
  /** Amount in USD. */
  amount: number;
  status: InvoiceStatus;
  /** ISO 8601 date. */
  dueDate: string;
}

interface Stats {
  /** Monthly recurring revenue in USD. */
  mrr: number;
  activeCustomers: number;
  /** Monthly churn as a percentage, e.g. 2.4 for 2.4%. */
  churnRate: number;
  recentInvoices: Invoice[];
}

const STATUS_STYLES: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "text-[#5fbf8f]" },
  pending: { label: "Pending", className: "text-[#e6c15a]" },
  overdue: { label: "Overdue", className: "text-[#ef6b5b]" },
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const currencyExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const integer = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const ROW_COUNT = 10;

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    fetch("/api/stats", { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`The stats service returned ${res.status}.`);
        }
        return res.json() as Promise<Stats>;
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        const timedOut = err instanceof DOMException && err.name === "TimeoutError";
        setError(
          timedOut
            ? "The stats service did not respond within 10 seconds."
            : err instanceof Error
              ? err.message
              : "The stats request failed."
        );
        setLoading(false);
      });
  }, []);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, attempt]);

  const invoices = stats?.recentInvoices.slice(0, ROW_COUNT) ?? [];

  return (
    <main
      className="min-h-screen bg-[#0e0f11] p-6 font-sans text-sm text-[#e8e6e1]"
      aria-busy={loading}
    >
      <h1 className="mb-6 text-[28px] font-semibold leading-[1.15]">Ledgerly admin</h1>

      {error ? (
        <div role="alert" className="rounded-[6px] border border-[#2a2e34] bg-[#15171a] p-4">
          <p className="font-semibold text-[#ef6b5b]">Could not load dashboard stats</p>
          <p className="mt-1">{error} Check your connection, then retry.</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-4 h-8 rounded-[2px] bg-[#f2a33a] px-3 text-sm font-medium text-[#1a1206] transition-colors hover:bg-[#f5b45c]"
          >
            Retry loading stats
          </button>
        </div>
      ) : (
        <>
          <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Monthly recurring revenue"
              value={stats ? currency.format(stats.mrr) : null}
            />
            <StatCard
              label="Active customers"
              value={stats ? integer.format(stats.activeCustomers) : null}
            />
            <StatCard
              label="Churn rate"
              value={stats ? `${stats.churnRate.toFixed(1)}%` : null}
            />
          </section>

          <section
            aria-label="Recent invoices"
            className="mt-6 overflow-x-auto rounded-[6px] border border-[#2a2e34] bg-[#15171a]"
          >
            <h2 className="px-4 py-3 text-base font-semibold leading-[1.15]">Recent invoices</h2>
            <table className="w-full border-collapse text-left tabular-nums">
              <thead>
                <tr className="border-t border-[#2a2e34] text-xs font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
                  <th className="h-8 px-4 font-medium">Customer</th>
                  <th className="h-8 px-4 text-right font-medium">Amount</th>
                  <th className="h-8 px-4 font-medium">Status</th>
                  <th className="h-8 px-4 text-right font-medium">Due date</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: ROW_COUNT }, (_, i) => (
                      <tr key={i} className="border-t border-[#2a2e34]">
                        <td colSpan={4} className="h-8 px-4">
                          <span className="block h-3 w-full rounded-[2px] bg-[#1c1f23]" />
                        </td>
                      </tr>
                    ))
                  : invoices.length === 0
                    ? (
                      <tr className="border-t border-[#2a2e34]">
                        <td colSpan={4} className="h-8 px-4">
                          No invoices have been issued yet.
                        </td>
                      </tr>
                    )
                    : invoices.map((inv) => {
                        const status = STATUS_STYLES[inv.status];
                        return (
                          <tr key={inv.id} className="h-8 border-t border-[#2a2e34]">
                            <td className="px-4">{inv.customer}</td>
                            <td className="px-4 text-right font-mono tabular-nums">
                              {currencyExact.format(inv.amount)}
                            </td>
                            <td className={`px-4 font-medium ${status.className}`}>
                              {status.label}
                            </td>
                            <td className="px-4 text-right font-mono tabular-nums">
                              {dateFormat.format(new Date(inv.dueDate))}
                            </td>
                          </tr>
                        );
                      })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-[6px] border border-[#2a2e34] bg-[#15171a] p-4">
      <p className="text-xs font-medium uppercase leading-4 tracking-[0.06em] text-[#9a9ea6]">
        {label}
      </p>
      {value === null ? (
        <span className="mt-2 block h-7 w-24 rounded-[2px] bg-[#1c1f23]" />
      ) : (
        <p className="mt-2 font-mono text-[28px] font-semibold leading-7 tabular-nums">{value}</p>
      )}
    </div>
  );
}
