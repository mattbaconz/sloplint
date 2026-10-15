import { useCallback, useEffect, useState } from "react";

type InvoiceStatus = "paid" | "open" | "overdue" | "void";

interface Invoice {
  id: string;
  customer: string;
  /** Amount in minor units (cents). */
  amount: number;
  currency: string;
  status: InvoiceStatus;
  /** ISO 8601 date. */
  dueDate: string;
}

interface Stats {
  /** Monthly recurring revenue in minor units (cents). */
  mrr: number;
  currency: string;
  activeCustomers: number;
  /** Fraction between 0 and 1, e.g. 0.023 for 2.3%. */
  churnRate: number;
  recentInvoices: Invoice[];
}

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; stats: Stats };

const TOKENS = `
@import url("https://fonts.googleapis.com/css2?family=Anton:wght@400&family=Inter+Tight:wght@400;600&family=DM+Mono:wght@400;500&display=swap");
.ledgerly-dashboard {
  --bg: #f5f3f1;
  --surface: #f9f8f7;
  --surface-2: #e9e7e5;
  --line: #cbc8c6;
  --ink: #151211;
  --ink-2: #686564;
  --accent: #bd5401;
  --accent-ink: #b45003;
  --on-accent: #fff9f5;
  --ok: #1d7d3e;
  --warn: #8d5e05;
  --danger: #a7463e;
  --font-display: "Anton", system-ui, sans-serif;
  --font-text: "Inter Tight", system-ui, sans-serif;
  --font-mono: "DM Mono", ui-monospace, Menlo, Consolas, monospace;
  --border: 2px;
  --shadow: 4px 4px 0 var(--ink);
  font-family: var(--font-text);
}
.ledgerly-dashboard .ld-display { font-family: var(--font-display); }
.ledgerly-dashboard .ld-mono { font-family: var(--font-mono); }
`;

const STATUS_STYLE: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "text-[var(--ok)] border-[var(--ok)]" },
  open: { label: "Open", className: "text-[var(--ink)] border-[var(--ink)]" },
  overdue: { label: "Overdue", className: "text-[var(--danger)] border-[var(--danger)]" },
  void: { label: "Void", className: "text-[var(--ink-2)] border-[var(--line)]" },
};

const DISPLAY = "ld-display uppercase leading-[1.05]";
const MONO = "ld-mono tabular-nums";

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function formatInvoiceAmount(minor: number, currency: string): string {
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

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

async function fetchStats(signal: AbortSignal): Promise<Stats> {
  const res = await fetch("/api/stats", { signal });
  if (!res.ok) {
    throw new Error(`The stats service answered ${res.status}${res.statusText ? ` ${res.statusText}` : ""}.`);
  }
  return (await res.json()) as Stats;
}

function SectionLabel({ number, children }: { number: string; children: string }) {
  return (
    <div className="mb-6 flex items-baseline gap-4">
      <span className={`${MONO} text-sm text-[var(--ink-2)]`}>{number}</span>
      <h2 className={`${DISPLAY} text-4xl text-[var(--ink)]`}>{children}</h2>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-3"
      aria-hidden="true"
    >
      <div className="h-48 border-2 border-[var(--line)] bg-[var(--surface-2)] md:col-span-2" />
      <div className="grid gap-6">
        <div className="h-[5.5rem] border-2 border-[var(--line)] bg-[var(--surface-2)]" />
        <div className="h-[5.5rem] border-2 border-[var(--line)] bg-[var(--surface-2)]" />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="border-2 border-[var(--line)] bg-[var(--surface)]" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="h-12 border-b border-[var(--line)] last:border-b-0" />
      ))}
    </div>
  );
}

function StatCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="border-2 border-[var(--ink)] bg-[var(--accent)] p-6 text-[var(--on-accent)] shadow-[var(--shadow)] md:col-span-2">
        <p className={`${MONO} text-sm uppercase`}>Monthly recurring revenue</p>
        <p className={`${DISPLAY} mt-4 text-[clamp(3.375rem,9vw,7.594rem)] tabular-nums`}>
          {formatMoney(stats.mrr, stats.currency)}
        </p>
      </div>
      <div className="grid gap-6">
        <div className="border-2 border-[var(--line)] bg-[var(--surface)] p-6">
          <p className={`${MONO} text-sm uppercase text-[var(--ink-2)]`}>Active customers</p>
          <p className={`${DISPLAY} mt-2 text-4xl tabular-nums text-[var(--ink)]`}>
            {stats.activeCustomers.toLocaleString("en-US")}
          </p>
        </div>
        <div className="border-2 border-[var(--line)] bg-[var(--surface)] p-6">
          <p className={`${MONO} text-sm uppercase text-[var(--ink-2)]`}>Churn rate</p>
          <p className={`${DISPLAY} mt-2 text-4xl tabular-nums text-[var(--ink)]`}>
            {formatPercent(stats.churnRate)}
          </p>
        </div>
      </div>
    </div>
  );
}

function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <p className="border-2 border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink)]">
        No invoices have been issued yet. New invoices appear here as soon as they are created.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border-2 border-[var(--line)] bg-[var(--surface)]">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">The 10 most recent invoices</caption>
        <thead>
          <tr className="border-b-2 border-[var(--ink)] text-sm text-[var(--ink)]">
            <th scope="col" className={`${MONO} px-4 py-3 font-medium uppercase`}>Customer</th>
            <th scope="col" className={`${MONO} px-4 py-3 text-right font-medium uppercase`}>Amount</th>
            <th scope="col" className={`${MONO} px-4 py-3 font-medium uppercase`}>Status</th>
            <th scope="col" className={`${MONO} px-4 py-3 text-right font-medium uppercase`}>Due date</th>
          </tr>
        </thead>
        <tbody>
          {invoices.slice(0, 10).map((invoice) => {
            const status = STATUS_STYLE[invoice.status] ?? STATUS_STYLE.open;
            return (
              <tr
                key={invoice.id}
                className="border-b border-[var(--line)] transition-colors duration-[80ms] ease-linear last:border-b-0 hover:bg-[var(--ink)] hover:text-[var(--bg)]"
              >
                <th scope="row" className="px-4 py-3 font-semibold">{invoice.customer}</th>
                <td className={`${MONO} px-4 py-3 text-right`}>
                  {formatInvoiceAmount(invoice.amount, invoice.currency)}
                </td>
                <td className="px-4 py-3">
                  <span className={`${MONO} inline-block border-2 px-2 py-0.5 text-xs uppercase ${status.className}`}>
                    {status.label}
                  </span>
                </td>
                <td className={`${MONO} px-4 py-3 text-right`}>{formatDate(invoice.dueDate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setState({ kind: "loading" });

    fetchStats(controller.signal)
      .then((stats) => setState({ kind: "ready", stats }))
      .catch((err: unknown) => {
        const timedOut = err instanceof DOMException && err.name === "AbortError";
        setState({
          kind: "error",
          message: timedOut
            ? "The stats service did not answer within 10 seconds."
            : err instanceof Error
              ? err.message
              : "The stats response could not be read.",
        });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <main className="ledgerly-dashboard min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <style>{TOKENS}</style>
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-24">
        <h1 className={`${DISPLAY} mb-14 text-[clamp(3.375rem,9.49vw,7.594rem)] sm:mb-24`}>
          Ledgerly admin
        </h1>

        {state.kind === "error" ? (
          <section
            role="alert"
            className="border-2 border-[var(--danger)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]"
          >
            <h2 className={`${DISPLAY} text-3xl text-[var(--danger)]`}>Stats failed to load</h2>
            <p className="mt-3 max-w-[62ch]">
              {state.message} The numbers on this page are not current. Check your connection and
              retry; if it keeps failing, the service at /api/stats is down.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-5 h-10 border-2 border-[var(--ink)] bg-[var(--accent)] px-4 font-semibold text-[var(--on-accent)] transition-colors duration-[80ms] ease-linear hover:bg-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Retry loading stats
            </button>
          </section>
        ) : (
          <div aria-busy={state.kind === "loading"} className="space-y-14 sm:space-y-24">
            <section>
              <SectionLabel number="01">Key figures</SectionLabel>
              {state.kind === "loading" ? <StatsSkeleton /> : <StatCards stats={state.stats} />}
            </section>

            <section>
              <SectionLabel number="02">Recent invoices</SectionLabel>
              {state.kind === "loading" ? (
                <TableSkeleton />
              ) : (
                <InvoiceTable invoices={state.stats.recentInvoices} />
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
