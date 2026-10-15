import { useCallback, useEffect, useState } from "react";

type InvoiceStatus = "paid" | "pending" | "overdue";

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
const integer = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  paid: "text-[var(--ok)] border-[var(--ok)]",
  pending: "text-[var(--warn)] border-[var(--warn)]",
  overdue: "text-[var(--danger)] border-[var(--danger)]",
};

const MONO = "tabular-nums";
const MONO_FACE = { fontFamily: "var(--font-mono)" };
const TEXT_FACE = { fontFamily: "var(--font-text)" };
const DISPLAY_FACE = { fontFamily: "var(--font-display)" };
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export default function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async (signal: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/stats", { signal });
      if (!res.ok) {
        throw new Error(`The stats service answered ${res.status} ${res.statusText}.`.trim());
      }
      const stats = (await res.json()) as Stats;
      setState({ kind: "ready", stats });
    } catch (err) {
      if (signal.aborted) return;
      const reason =
        err instanceof Error
          ? err.message
          : "The request did not complete (network error or invalid JSON).";
      setState({ kind: "error", message: reason });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const retry = () => {
    void load(new AbortController().signal);
  };

  return (
    <main
      style={TEXT_FACE}
      className="min-h-screen bg-[var(--bg)] px-4 py-14 text-[var(--ink)] leading-[1.45] sm:py-24"
    >
      <div className="mx-auto max-w-[1200px]">
        <h1 style={DISPLAY_FACE} className="text-[clamp(2.25rem,9vw,3.375rem)] font-bold uppercase leading-[1.05]">
          Ledgerly admin
        </h1>

        {state.kind === "error" ? (
          <div
            role="alert"
            className="mt-14 border-2 border-[var(--danger)] bg-[var(--surface)] p-6 sm:mt-24"
          >
            <p className="font-bold text-[var(--danger)]">Stats failed to load.</p>
            <p className="mt-2 max-w-[62ch]">
              {state.message} Check your connection and retry; if it keeps failing, the
              /api/stats endpoint is down.
            </p>
            <button
              type="button"
              onClick={retry}
              className={`mt-4 h-10 bg-[var(--accent)] px-4 font-bold text-[var(--on-accent)] transition-colors duration-[80ms] ease-linear hover:bg-[var(--ink)] ${FOCUS}`}
            >
              Retry loading stats
            </button>
          </div>
        ) : (
          <>
            <Section number="01" title="Key figures">
              <dl
                aria-busy={state.kind === "loading"}
                className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-12"
              >
                <Stat
                  label="Monthly recurring revenue"
                  loading={state.kind === "loading"}
                  value={state.kind === "ready" ? currency.format(state.stats.mrr / 100) : ""}
                  className="sm:col-span-2 lg:col-span-6"
                  highlight
                />
                <Stat
                  label="Active customers"
                  loading={state.kind === "loading"}
                  value={state.kind === "ready" ? integer.format(state.stats.activeCustomers) : ""}
                  className="lg:col-span-3"
                />
                <Stat
                  label="Churn rate"
                  loading={state.kind === "loading"}
                  value={state.kind === "ready" ? `${state.stats.churnRate.toFixed(1)}%` : ""}
                  className="lg:col-span-3"
                />
              </dl>
            </Section>

            <Section number="02" title="Recent invoices">
              <div className="overflow-x-auto border-2 border-[var(--line)]">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead>
                    <tr className="border-b-2 border-[var(--line)] bg-[var(--surface)]">
                      <th scope="col" className="px-4 py-3 font-bold">Customer</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">Amount</th>
                      <th scope="col" className="px-4 py-3 font-bold">Status</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">Due date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.kind === "loading" ? (
                      <SkeletonRows />
                    ) : state.stats.recentInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6">
                          No invoices have been issued yet.
                        </td>
                      </tr>
                    ) : (
                      state.stats.recentInvoices.slice(0, 10).map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-b border-[var(--line)] transition-colors duration-[80ms] ease-linear last:border-b-0 hover:bg-[var(--surface-2)]"
                        >
                          <td className="px-4 py-3">{inv.customer}</td>
                          <td style={MONO_FACE} className={`px-4 py-3 text-right ${MONO}`}>
                            {currency.format(inv.amount / 100)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block border-2 px-2 text-sm font-bold uppercase ${STATUS_STYLE[inv.status]}`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td style={MONO_FACE} className={`px-4 py-3 text-right ${MONO}`}>
                            {dateFormat.format(new Date(inv.dueDate))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 sm:mt-24">
      <div className="flex items-baseline gap-4">
        <span style={MONO_FACE} className={`${MONO} text-[var(--ink-2)]`}>{number}</span>
        <h2 style={DISPLAY_FACE} className="text-2xl font-bold uppercase leading-[1.05]">
          {title}
        </h2>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  loading,
  highlight = false,
  className = "",
}: {
  label: string;
  value: string;
  loading: boolean;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`border-2 border-[var(--line)] bg-[var(--surface)] p-6 ${className}`}
    >
      <dt className="font-bold">{label}</dt>
      <dd
        style={MONO_FACE}
        className={`${MONO} relative mt-3 text-[clamp(2.25rem,6vw,3.375rem)] font-medium leading-[1.05] ${
          highlight ? "text-[var(--accent-ink)]" : "text-[var(--ink)]"
        }`}
      >
        {/* Placeholder keeps the card's final height while loading. */}
        <span className={loading ? "invisible" : undefined}>{loading ? "$000,000.00" : value}</span>
        {loading && (
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-0 w-3/5 bg-[var(--surface-2)]"
          />
        )}
        {loading && <span className="sr-only">Loading</span>}
      </dd>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <tr key={i} className="border-b border-[var(--line)] last:border-b-0" aria-hidden="true">
          {[0, 1, 2, 3].map((c) => (
            <td key={c} className="px-4 py-3">
              <span className="block h-6 w-full max-w-[8rem] bg-[var(--surface-2)]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
