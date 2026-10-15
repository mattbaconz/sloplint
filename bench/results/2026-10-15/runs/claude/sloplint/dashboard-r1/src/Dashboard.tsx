import { useCallback, useEffect, useState } from "react";

type InvoiceStatus = "paid" | "open" | "overdue" | "draft";

interface Invoice {
  id: string;
  customer: string;
  /** Amount in cents (USD). */
  amount: number;
  status: InvoiceStatus;
  /** ISO 8601 date, e.g. "2026-10-31". */
  dueDate: string;
}

interface Stats {
  /** Monthly recurring revenue in cents (USD). */
  mrr: number;
  activeCustomers: number;
  /** Monthly churn as a fraction, 0.021 = 2.1%. */
  churnRate: number;
  recentInvoices: Invoice[];
}

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; stats: Stats };

const TOKENS = `
@import url("https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600&family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@400;500&display=swap");
.ledgerly-dashboard {
  --bg: #f4faff;
  --surface: #fdfdfe;
  --surface-2: #e7eff4;
  --line: #c7d0d6;
  --ink: #12191e;
  --ink-2: #616a71;
  --accent: #05628a;
  --accent-ink: #05628a;
  --on-accent: #f5fbff;
  --ok: #1d7d3e;
  --warn: #8d5e05;
  --danger: #a7463e;
  --font-display: "Newsreader", Georgia, "Times New Roman", serif;
  --font-text: "Atkinson Hyperlegible", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
  --step-0: 1rem;
  --step-1: 1.25rem;
  --step-2: 1.563rem;
  --step-5: clamp(1.953rem, 3.81vw, 3.052rem);
  --step--1: 0.8rem;
  --radius: 6px;
  --radius-lg: 8px;
  --duration: 150ms;
  --ease: cubic-bezier(0.2, 0, 0, 1);
}
.ld-text { font-family: var(--font-text); }
.ld-display { font-family: var(--font-display); }
.ld-mono { font-family: var(--font-mono); }
`;

const FETCH_TIMEOUT_MS = 10_000;

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const count = new Intl.NumberFormat("en-US");
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const STATUS_STYLE: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "text-[var(--ok)]" },
  open: { label: "Open", className: "text-[var(--ink-2)]" },
  overdue: { label: "Overdue", className: "text-[var(--danger)]" },
  draft: { label: "Draft", className: "text-[var(--warn)]" },
};

function formatDate(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
}

async function loadStats(signal: AbortSignal): Promise<Stats> {
  const res = await fetch("/api/stats", {
    signal: AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Your session has expired or you lack admin access. Sign in again to view stats."
        : `The stats service returned ${res.status}. Reload in a minute; if it persists, check the API logs.`,
    );
  }
  return (await res.json()) as Stats;
}

function describeError(err: unknown): string {
  if (err instanceof Error && err.name === "TimeoutError") {
    return "The stats request took longer than 10 seconds. Check your connection and reload.";
  }
  if (err instanceof TypeError) {
    return "Could not reach /api/stats. Check your connection and reload.";
  }
  if (err instanceof Error) return err.message;
  return "Stats failed to load for an unknown reason. Reload the page.";
}

function Skeleton({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded-[var(--radius)] bg-[var(--surface-2)] ${className}`}
    />
  );
}

export default function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    loadStats(controller.signal)
      .then((stats) => setState({ kind: "ready", stats }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: describeError(err) });
      });
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const stats = state.kind === "ready" ? state.stats : null;
  const invoices = stats ? stats.recentInvoices.slice(0, 10) : [];

  return (
    <div className="ledgerly-dashboard min-h-screen bg-[var(--bg)] ld-text text-[length:var(--step-0)] leading-[1.6] text-[var(--ink)]">
      <style>{TOKENS}</style>
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-[88px]">
        <div className="grid grid-cols-1 gap-14 md:grid-cols-12 md:gap-6">
          <section
            aria-labelledby="mrr-heading"
            className="md:col-span-5 md:sticky md:top-8 md:self-start"
          >
            <h1
              id="mrr-heading"
              className="ld-display text-[length:var(--step-2)] font-semibold leading-[1.05] tracking-[-0.01em]"
            >
              Monthly recurring revenue
            </h1>
            <p
              aria-live="polite"
              className="mt-4 ld-mono text-[length:var(--step-5)] font-medium leading-[1.05] tabular-nums text-[var(--accent-ink)]"
            >
              {stats ? usd.format(stats.mrr / 100) : <Skeleton className="h-[1.05em] w-3/4" />}
            </p>
          </section>

          <div className="md:col-span-7">
            {state.kind === "error" && (
              <div
                role="alert"
                className="rounded-[var(--radius-lg)] border border-[var(--danger)] bg-[var(--surface)] p-6"
              >
                <h2 className="ld-display text-[length:var(--step-1)] font-semibold">
                  Stats did not load
                </h2>
                <p className="mt-2">{state.message}</p>
                <button
                  type="button"
                  onClick={reload}
                  className="mt-4 h-10 rounded-[var(--radius)] bg-[var(--accent)] px-4 font-bold text-[var(--on-accent)] transition-opacity duration-[var(--duration)] ease-[var(--ease)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] motion-reduce:transition-none"
                >
                  Reload stats
                </button>
              </div>
            )}

            {state.kind !== "error" && (
              <>
                <dl
                  aria-busy={state.kind === "loading"}
                  className="grid grid-cols-1 gap-6 sm:grid-cols-2"
                >
                  <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-6 shadow-[0_1px_2px_rgb(18_25_30/0.06),0_8px_24px_rgb(18_25_30/0.06)]">
                    <dt className="text-[length:var(--step--1)] text-[var(--ink-2)]">
                      Active customers
                    </dt>
                    <dd className="mt-2 ld-mono text-[length:var(--step-2)] font-medium tabular-nums">
                      {stats ? count.format(stats.activeCustomers) : <Skeleton className="h-[1.563rem] w-24" />}
                    </dd>
                  </div>
                  <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-6 shadow-[0_1px_2px_rgb(18_25_30/0.06),0_8px_24px_rgb(18_25_30/0.06)]">
                    <dt className="text-[length:var(--step--1)] text-[var(--ink-2)]">
                      Monthly churn rate
                    </dt>
                    <dd className="mt-2 ld-mono text-[length:var(--step-2)] font-medium tabular-nums">
                      {stats ? percent.format(stats.churnRate) : <Skeleton className="h-[1.563rem] w-24" />}
                    </dd>
                  </div>
                </dl>

                <h2 className="mt-14 ld-display text-[length:var(--step-1)] font-semibold">
                  10 most recent invoices
                </h2>
                <div
                  aria-busy={state.kind === "loading"}
                  className="mt-4 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]"
                >
                  <table className="w-full min-w-[520px] border-collapse text-left">
                    <thead>
                      <tr className="text-[length:var(--step--1)] text-[var(--ink-2)]">
                        <th scope="col" className="px-4 py-3 font-bold">Customer</th>
                        <th scope="col" className="px-4 py-3 text-right font-bold">Amount</th>
                        <th scope="col" className="px-4 py-3 font-bold">Status</th>
                        <th scope="col" className="px-4 py-3 text-right font-bold">Due date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.kind === "loading" &&
                        Array.from({ length: 10 }, (_, i) => (
                          <tr key={i} className="border-t border-[var(--line)]">
                            <td className="px-4 py-3"><Skeleton className="h-5 w-40" /></td>
                            <td className="px-4 py-3"><Skeleton className="ml-auto h-5 w-20" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                            <td className="px-4 py-3"><Skeleton className="ml-auto h-5 w-24" /></td>
                          </tr>
                        ))}
                      {state.kind === "ready" && invoices.length === 0 && (
                        <tr className="border-t border-[var(--line)]">
                          <td colSpan={4} className="px-4 py-6 text-[var(--ink-2)]">
                            No invoices have been issued yet. New invoices appear here once created.
                          </td>
                        </tr>
                      )}
                      {invoices.map((invoice) => {
                        const status = STATUS_STYLE[invoice.status] ?? {
                          label: invoice.status,
                          className: "text-[var(--ink-2)]",
                        };
                        return (
                          <tr key={invoice.id} className="border-t border-[var(--line)]">
                            <td className="px-4 py-3">{invoice.customer}</td>
                            <td className="px-4 py-3 text-right ld-mono tabular-nums">
                              {usdExact.format(invoice.amount / 100)}
                            </td>
                            <td className={`px-4 py-3 font-bold ${status.className}`}>{status.label}</td>
                            <td className="px-4 py-3 text-right ld-mono tabular-nums">
                              {formatDate(invoice.dueDate)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
