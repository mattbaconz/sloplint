import { useCallback, useEffect, useState } from "react";

type InvoiceStatus = "paid" | "open" | "overdue" | "void";

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

const REQUEST_TIMEOUT_MS = 10_000;
const INVOICE_LIMIT = 10;

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
  day: "2-digit",
});

const STATUS_STYLES: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "text-[#5fbf8f]" },
  open: { label: "Open", className: "text-[#e6c15a]" },
  overdue: { label: "Overdue", className: "text-[#ef6b5b]" },
  void: { label: "Void", className: "text-[#9a9ea6]" },
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
}

async function fetchStats(signal: AbortSignal): Promise<Stats> {
  const response = await fetch("/api/stats", { signal });
  if (!response.ok) {
    throw new Error(`The stats service responded with ${response.status}.`);
  }
  return (await response.json()) as Stats;
}

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "The stats service did not answer within 10 seconds. Check your connection and retry.";
  }
  if (err instanceof Error && err.message.startsWith("The stats service")) {
    return `${err.message} Retry in a moment, or contact the platform team if it keeps failing.`;
  }
  return "Could not reach /api/stats. Check your connection and retry.";
}

function StatCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="p-6">
      <dt className="text-xs font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
        {label}
      </dt>
      <dd className="mt-2 h-10 font-mono text-[28px] font-semibold leading-10 tabular-nums text-[#e8e6e1]">
        {value ?? <span className="block h-6 w-32 translate-y-2 rounded-[2px] bg-[#1c1f23]" />}
      </dd>
    </div>
  );
}

function InvoiceRows({ invoices }: { invoices: Invoice[] | null }) {
  if (invoices === null) {
    return (
      <>
        {Array.from({ length: INVOICE_LIMIT }, (_, i) => (
          <tr key={i} className="h-8 border-t border-[#2a2e34]">
            <td colSpan={4} className="px-6">
              <span className="block h-3 w-full rounded-[2px] bg-[#1c1f23]" />
            </td>
          </tr>
        ))}
      </>
    );
  }
  if (invoices.length === 0) {
    return (
      <tr className="h-8 border-t border-[#2a2e34]">
        <td colSpan={4} className="px-6 py-4 text-[#e8e6e1]">
          No invoices have been issued yet.
        </td>
      </tr>
    );
  }
  return (
    <>
      {invoices.slice(0, INVOICE_LIMIT).map((invoice) => {
        const status = STATUS_STYLES[invoice.status];
        return (
          <tr key={invoice.id} className="h-8 border-t border-[#2a2e34]">
            <td className="px-6 text-[#e8e6e1]">{invoice.customer}</td>
            <td className="px-6 text-right font-mono tabular-nums text-[#e8e6e1]">
              {currencyExact.format(invoice.amount)}
            </td>
            <td className={`px-6 font-medium ${status.className}`}>{status.label}</td>
            <td className="px-6 text-right font-mono tabular-nums text-[#e8e6e1]">
              {formatDate(invoice.dueDate)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = AbortSignal.any([controller.signal, timeout]);

    fetchStats(signal)
      .then((data) => {
        setStats(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(describeError(err));
      });

    return () => controller.abort();
  }, [attempt]);

  const loading = stats === null && error === null;

  return (
    <main className="min-h-screen bg-[#0e0f11] p-6 font-sans text-sm leading-5 text-[#e8e6e1]">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-xl font-semibold leading-[1.15]">Ledgerly admin dashboard</h1>

        {error !== null && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-4 rounded-md border border-[#ef6b5b] bg-[#15171a] p-4"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={retry}
              className="h-8 shrink-0 rounded-[2px] bg-[#f2a33a] px-3 font-medium text-[#1a1206] transition-opacity duration-150 ease-out hover:opacity-90"
            >
              Retry loading stats
            </button>
          </div>
        )}

        <div
          aria-busy={loading}
          className="overflow-hidden rounded-md border border-[#2a2e34] bg-[#15171a]"
        >
          <dl className="grid grid-cols-1 divide-y divide-[#2a2e34] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <StatCell
              label="Monthly recurring revenue"
              value={stats ? currency.format(stats.mrr) : null}
            />
            <StatCell
              label="Active customers"
              value={stats ? integer.format(stats.activeCustomers) : null}
            />
            <StatCell
              label="Churn rate"
              value={stats ? `${stats.churnRate.toFixed(1)}%` : null}
            />
          </dl>

          <div className="overflow-x-auto border-t border-[#2a2e34]">
            <table className="w-full border-collapse text-left">
              <caption className="px-6 py-4 text-left text-base font-semibold leading-[1.15]">
                10 most recent invoices
              </caption>
              <thead>
                <tr className="h-8 bg-[#15171a] text-xs font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
                  <th scope="col" className="px-6 font-medium">Customer</th>
                  <th scope="col" className="px-6 text-right font-medium">Amount</th>
                  <th scope="col" className="px-6 font-medium">Status</th>
                  <th scope="col" className="px-6 text-right font-medium">Due date</th>
                </tr>
              </thead>
              <tbody>
                <InvoiceRows invoices={stats ? stats.recentInvoices : error === null ? null : []} />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
