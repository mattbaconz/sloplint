import { useCallback, useEffect, useState } from "react";

type InvoiceStatus = "paid" | "open" | "overdue";

interface Invoice {
  id: string;
  customer: string;
  /** Amount in cents. */
  amount: number;
  status: InvoiceStatus;
  /** ISO 8601 date. */
  dueDate: string;
}

interface Stats {
  /** Monthly recurring revenue in cents. */
  mrr: number;
  activeCustomers: number;
  /** Monthly churn as a percentage, e.g. 2.4 for 2.4%. */
  churnRate: number;
  recentInvoices: Invoice[];
}

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; stats: Stats };

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const count = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const statusStyle: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "text-[var(--ok)]" },
  open: { label: "Open", className: "text-[var(--warn)]" },
  overdue: { label: "Overdue", className: "text-[var(--danger)]" },
};

const displayFont = { fontFamily: "var(--font-display)" };
const monoFont = { fontFamily: "var(--font-mono)" };
const textFont = { fontFamily: "var(--font-text)" };
const display = "font-bold";
const mono = "tabular-nums";

async function loadStats(signal: AbortSignal): Promise<Stats> {
  const res = await fetch("/api/stats", { signal });
  if (!res.ok) {
    throw new Error(`The stats service responded with ${res.status}.`);
  }
  return (await res.json()) as Stats;
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <dt className="text-[length:var(--step--1)] text-[var(--ink-2)]">{label}</dt>
      <dd
        style={monoFont}
        className={`${mono} mt-2 text-[length:var(--step-3)] leading-none ${
          highlight ? "text-[var(--accent-ink)]" : "text-[var(--ink)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <div className="h-[1.3em] w-32 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
      <div className="mt-2 h-[2.075rem] w-40 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
    </div>
  );
}

function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]">
      <table className="w-full min-w-[34rem] border-collapse text-left text-[length:var(--step-0)]">
        <caption className="sr-only">10 most recent invoices</caption>
        <thead>
          <tr className="border-b border-[var(--line)] text-[length:var(--step--1)] text-[var(--ink-2)]">
            <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Due date</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const status = statusStyle[inv.status];
            return (
              <tr key={inv.id} className="border-b border-[var(--line)] last:border-b-0">
                <td className="px-4 py-3 text-[var(--ink)]">{inv.customer}</td>
                <td style={monoFont} className={`${mono} px-4 py-3 text-right text-[var(--ink)]`}>
                  {currency.format(inv.amount / 100)}
                </td>
                <td className={`px-4 py-3 font-semibold ${status.className}`}>{status.label}</td>
                <td style={monoFont} className={`${mono} px-4 py-3 text-right text-[var(--ink)]`}>
                  {dateFormat.format(new Date(inv.dueDate))}
                </td>
              </tr>
            );
          })}
          {invoices.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-[var(--ink-2)]">
                No invoices have been issued yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]">
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className="h-[3.0rem] border-b border-[var(--line)] px-4 py-3 last:border-b-0"
        >
          <div className="h-full w-full rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    setState({ kind: "loading" });

    loadStats(controller.signal)
      .then((stats) => {
        if (active) setState({ kind: "ready", stats });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const timedOut = controller.signal.aborted;
        setState({
          kind: "error",
          message: timedOut
            ? "The stats service did not respond within 10 seconds."
            : err instanceof Error
              ? err.message
              : "The stats request failed.",
        });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <main style={textFont} className="min-h-screen bg-[var(--bg)] px-4 py-10 text-[var(--ink)] sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <h1 style={displayFont} className={`${display} text-[length:var(--step-4)] leading-[1.05]`}>
          Ledgerly admin dashboard
        </h1>

        {state.kind === "error" && (
          <div
            role="alert"
            className="mt-10 rounded-[var(--radius-lg)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]"
          >
            <p className="font-semibold text-[var(--danger)]">Dashboard stats did not load.</p>
            <p className="mt-1 text-[var(--ink)]">{state.message}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 h-10 rounded-[var(--radius)] bg-[var(--accent)] px-4 font-semibold text-[var(--on-accent)] transition-opacity duration-[220ms] ease-[cubic-bezier(0.3,0,0,1)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Reload stats
            </button>
          </div>
        )}

        {state.kind !== "error" && (
          <div aria-busy={state.kind === "loading"}>
            <section aria-labelledby="stats-heading" className="mt-10">
              <h2 id="stats-heading" className="sr-only">Key metrics</h2>
              <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-[5fr_3.5fr_3.5fr]">
                {state.kind === "loading" ? (
                  <>
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                  </>
                ) : (
                  <>
                    <StatCard
                      label="Monthly recurring revenue"
                      value={currency.format(state.stats.mrr / 100)}
                      highlight
                    />
                    <StatCard
                      label="Active customers"
                      value={count.format(state.stats.activeCustomers)}
                    />
                    <StatCard
                      label="Churn rate"
                      value={`${state.stats.churnRate.toFixed(1)}%`}
                    />
                  </>
                )}
              </dl>
            </section>

            <section aria-labelledby="invoices-heading" className="mt-16">
              <h2 id="invoices-heading" style={displayFont} className={`${display} mb-4 text-[length:var(--step-2)] leading-[1.05]`}>
                Recent invoices
              </h2>
              {state.kind === "loading" ? (
                <InvoiceTableSkeleton />
              ) : (
                <InvoiceTable invoices={state.stats.recentInvoices.slice(0, 10)} />
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
