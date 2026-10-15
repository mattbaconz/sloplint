import { useCallback, useEffect, useState } from "react";

type InvoiceStatus = "paid" | "open" | "overdue";

interface Invoice {
  id: string;
  customer: string;
  /** Amount in US dollars. */
  amount: number;
  status: InvoiceStatus;
  /** ISO 8601 date, e.g. "2026-11-03". */
  dueDate: string;
}

interface Stats {
  /** Monthly recurring revenue in US dollars. */
  mrr: number;
  activeCustomers: number;
  /** Monthly churn as a percentage, e.g. 2.4 for 2.4%. */
  churnRate: number;
  invoices: Invoice[];
}

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; stats: Stats };

const STATS_URL = "/api/stats";
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
  day: "numeric",
  timeZone: "UTC",
});

const STATUS_STYLE: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "text-[var(--ok)]" },
  open: { label: "Open", className: "text-[var(--warn)]" },
  overdue: { label: "Overdue", className: "text-[var(--danger)]" },
};

// Tokens from DESIGN.md (Harbor Split), scoped so the component renders
// correctly even when the host app has not defined them globally.
const TOKENS = `
.ledgerly-dashboard {
  --bg: #f2f6f8; --surface: #f8fafb; --surface-2: #e6eaec; --line: #c6cbce;
  --ink: #171c1e; --ink-2: #62676a; --accent: #005672; --accent-ink: #005672;
  --on-accent: #f5fbff; --ok: #1d7d3e; --warn: #8d5e05; --danger: #a7463e;
  --font-text: "Libre Franklin", system-ui, sans-serif;
  --font-mono: "DM Mono", ui-monospace, Menlo, Consolas, monospace;
  --radius: 6px; --radius-sm: 4px; --radius-lg: 8px;
}
@media (prefers-reduced-motion: reduce) {
  .ledgerly-dashboard * { animation: none !important; transition: none !important; }
}
`;

async function fetchStats(signal: AbortSignal): Promise<Stats> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = AbortSignal.any([signal, timeout]);
  let response: Response;
  try {
    response = await fetch(STATS_URL, { signal: combined });
  } catch (err) {
    if (signal.aborted) throw err;
    if (timeout.aborted) {
      throw new Error(
        `The stats service did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`,
      );
    }
    throw new Error("Could not reach the stats service. Check your connection.");
  }
  if (!response.ok) {
    throw new Error(`The stats service returned HTTP ${response.status}.`);
  }
  try {
    return (await response.json()) as Stats;
  } catch {
    throw new Error("The stats service returned a response that is not valid JSON.");
  }
}

export default function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal).then(
      (stats) => setState({ kind: "ready", stats }),
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Stats failed to load.",
        });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <div className="ledgerly-dashboard min-h-screen bg-[var(--bg)] font-[family-name:var(--font-text)] text-[var(--ink)]">
      <style>{TOKENS}</style>
      <main className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
        <h1 className="text-[1.953rem] font-semibold leading-[1.05] tracking-[-0.01em] md:text-[2.441rem]">
          Ledgerly admin dashboard
        </h1>

        <div aria-busy={state.kind === "loading"}>
          {state.kind === "ready" ? (
            <ReadyView stats={state.stats} />
          ) : state.kind === "error" ? (
            <ErrorView message={state.message} onRetry={retry} />
          ) : (
            <StatsSkeleton />
          )}
        </div>
      </main>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="mt-10">
      <span className="sr-only">Loading stats</span>
      <div className="grid grid-cols-1 gap-6 border-t border-[var(--line)] pt-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} aria-hidden="true">
            <div className="h-4 w-32 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
            <div className="mt-3 h-10 w-40 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-14 border-t border-[var(--line)] pt-6">
        <div className="h-6 w-48 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: INVOICE_LIMIT }, (_, i) => (
            <div key={i} className="h-5 w-full animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-10 border-t border-[var(--line)] pt-6">
      <h2 className="text-[1.25rem] font-semibold text-[var(--danger)]">Stats could not be loaded</h2>
      <p className="mt-2 max-w-[62ch]">{message} Your data has not changed. Try again in a moment.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 h-10 rounded-[var(--radius)] bg-[var(--accent)] px-4 font-semibold text-[var(--on-accent)] transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        Retry loading stats
      </button>
    </div>
  );
}

function ReadyView({ stats }: { stats: Stats }) {
  const invoices = stats.invoices.slice(0, INVOICE_LIMIT);

  return (
    <>
      <dl className="mt-10 grid grid-cols-1 gap-x-6 gap-y-6 border-t border-[var(--line)] pt-6 md:grid-cols-3">
        <Stat label="Monthly recurring revenue" value={currency.format(stats.mrr)} highlight />
        <Stat label="Active customers" value={integer.format(stats.activeCustomers)} />
        <Stat label="Monthly churn rate" value={`${stats.churnRate.toFixed(1)}%`} />
      </dl>

      <section className="mt-14 border-t border-[var(--line)] pt-6" aria-labelledby="recent-invoices">
        <h2 id="recent-invoices" className="text-[1.25rem] font-semibold">
          Recent invoices
        </h2>
        {invoices.length === 0 ? (
          <p className="mt-4">No invoices have been issued yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--line)] text-[0.8rem] text-[var(--ink-2)]">
                  <th scope="col" className="py-2 pr-4 font-semibold">Customer</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">Amount</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                  <th scope="col" className="py-2 text-right font-semibold">Due date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const status = STATUS_STYLE[invoice.status];
                  return (
                    <tr key={invoice.id} className="border-b border-[var(--line)]">
                      <th scope="row" className="py-3 pr-4 font-normal">{invoice.customer}</th>
                      <td className="py-3 pr-4 text-right font-[family-name:var(--font-mono)] tabular-nums">
                        {currencyExact.format(invoice.amount)}
                      </td>
                      <td className={`py-3 pr-4 font-semibold ${status.className}`}>
                        {status.label}
                      </td>
                      <td className="py-3 text-right font-[family-name:var(--font-mono)] tabular-nums">
                        {formatDate(invoice.dueDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-[0.8rem] text-[var(--ink-2)]">{label}</dt>
      <dd
        className={`mt-1 font-[family-name:var(--font-mono)] text-[1.953rem] font-medium tabular-nums ${
          highlight ? "text-[var(--accent-ink)]" : "text-[var(--ink)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
}
