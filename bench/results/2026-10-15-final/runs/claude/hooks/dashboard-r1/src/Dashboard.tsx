import { useCallback, useEffect, useState } from "react";

type InvoiceStatus = "paid" | "open" | "overdue" | "void";

interface Invoice {
  id: string;
  customer: string;
  amount: number; // minor units (cents)
  currency?: string;
  status: InvoiceStatus;
  dueDate: string; // ISO 8601 date
}

interface Stats {
  mrr: number; // minor units (cents)
  currency?: string;
  activeCustomers: number;
  churnRate: number; // percent, e.g. 2.4
  recentInvoices: Invoice[];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; stats: Stats };

const REQUEST_TIMEOUT_MS = 10_000;

const STATUS_TEXT: Record<InvoiceStatus, string> = {
  paid: "text-[var(--ok)]",
  open: "text-[var(--ink)]",
  overdue: "text-[var(--danger)]",
  void: "text-[var(--ink-2)]",
};

function formatMoney(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function fetchStats(): Promise<Stats> {
  let res: Response;
  try {
    res = await fetch("/api/stats", { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("GET /api/stats timed out after 10 seconds. Check your connection and retry.");
    }
    throw new Error("Could not reach /api/stats. Check your connection and retry.");
  }
  if (!res.ok) {
    throw new Error(`GET /api/stats returned ${res.status}. Retry, or check the API logs if it persists.`);
  }
  try {
    return (await res.json()) as Stats;
  } catch {
    throw new Error("GET /api/stats returned a body that is not valid JSON. Check the API logs.");
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-12 font-[family-name:var(--font-text)] text-[var(--ink)] sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="mb-8 font-[family-name:var(--font-display)] text-[length:var(--step-4)] font-bold leading-[1.05] tracking-[-0.02em]">
          Ledgerly admin
        </h1>
        {children}
      </div>
    </main>
  );
}

function StatStrip({ stats }: { stats: Stats }) {
  const items = [
    { label: "Monthly recurring revenue", value: formatMoney(stats.mrr, stats.currency), highlight: true },
    { label: "Active customers", value: stats.activeCustomers.toLocaleString("en-US"), highlight: false },
    { label: "Churn rate", value: `${stats.churnRate.toFixed(1)}%`, highlight: false },
  ];
  return (
    <dl className="grid grid-cols-1 divide-y divide-[var(--line)] rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {items.map((item) => (
        <div key={item.label} className="p-5">
          <dt className="font-[family-name:var(--font-mono)] text-[length:var(--step--1)] text-[var(--ink-2)]">
            {item.label}
          </dt>
          <dd
            className={`mt-2 font-[family-name:var(--font-mono)] text-[length:var(--step-3)] font-medium tabular-nums ${
              item.highlight ? "text-[var(--accent-ink)]" : "text-[var(--ink)]"
            }`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  const rows = invoices.slice(0, 10);
  return (
    <section className="mt-12" aria-labelledby="recent-invoices">
      <h2
        id="recent-invoices"
        className="mb-4 font-[family-name:var(--font-display)] text-[length:var(--step-2)] font-bold leading-[1.05] tracking-[-0.02em]"
      >
        Recent invoices
      </h2>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full min-w-[32rem] border-collapse text-left text-[length:var(--step-0)]">
          <thead>
            <tr className="border-b border-[var(--line)] font-[family-name:var(--font-mono)] text-[length:var(--step--1)] text-[var(--ink-2)]">
              <th scope="col" className="px-4 py-3 font-normal">Customer</th>
              <th scope="col" className="px-4 py-3 text-right font-normal">Amount</th>
              <th scope="col" className="px-4 py-3 font-normal">Status</th>
              <th scope="col" className="px-4 py-3 text-right font-normal">Due date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-[var(--ink-2)]">
                  No invoices yet. Invoices appear here once one is issued.
                </td>
              </tr>
            ) : (
              rows.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-[var(--line)] transition-colors duration-[120ms] last:border-b-0 hover:bg-[var(--surface-2)]"
                >
                  <td className="px-4 py-3">{inv.customer}</td>
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums">
                    {formatMoney(inv.amount, inv.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-[var(--radius-sm)] border border-[var(--line)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[length:var(--step--1)] ${STATUS_TEXT[inv.status] ?? "text-[var(--ink)]"}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums">
                    {formatDate(inv.dueDate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading dashboard stats</span>
      <div className="grid h-[6.5rem] grid-cols-1 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] sm:grid-cols-3" />
      <div className="mt-12 h-[26rem] rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]" />
    </div>
  );
}

export default function Dashboard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(() => {
    setState({ kind: "loading" });
    fetchStats().then(
      (stats) => setState({ kind: "ready", stats }),
      (err: Error) => setState({ kind: "error", message: err.message }),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <Shell>
        <LoadingSkeleton />
      </Shell>
    );
  }

  if (state.kind === "error") {
    return (
      <Shell>
        <div
          role="alert"
          className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-5"
        >
          <p className="font-bold text-[var(--danger)]">Dashboard stats failed to load</p>
          <p className="mt-2 text-[var(--ink-2)]">{state.message}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 h-10 rounded-[var(--radius)] bg-[var(--accent)] px-4 font-bold text-[var(--on-accent)] transition-opacity duration-[120ms] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Retry stats request
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <StatStrip stats={state.stats} />
      <InvoiceTable invoices={state.stats.recentInvoices} />
    </Shell>
  );
}
