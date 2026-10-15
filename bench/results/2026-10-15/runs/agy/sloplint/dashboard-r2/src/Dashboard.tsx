import React, { useCallback, useEffect, useState } from 'react';

export type Invoice = {
  id: string | number;
  customer: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | string;
  dueDate: string;
};

export type DashboardStats = {
  monthlyRecurringRevenue: number;
  activeCustomers: number;
  churnRate: number;
  invoices: Invoice[];
};

type RawInvoicePayload = {
  id?: string | number;
  customer?: string | { name?: string };
  amount?: number;
  status?: string;
  dueDate?: string;
  due_date?: string;
};

type RawStatsPayload = {
  monthlyRecurringRevenue?: number;
  monthly_recurring_revenue?: number;
  mrr?: number;
  revenue?: number;
  activeCustomers?: number;
  active_customers?: number;
  customers?: number;
  churnRate?: number;
  churn_rate?: number;
  churn?: number;
  invoices?: RawInvoicePayload[];
  recentInvoices?: RawInvoicePayload[];
  recent_invoices?: RawInvoicePayload[];
  stats?: {
    monthlyRecurringRevenue?: number;
    monthly_recurring_revenue?: number;
    mrr?: number;
    revenue?: number;
    activeCustomers?: number;
    active_customers?: number;
    customers?: number;
    churnRate?: number;
    churn_rate?: number;
    churn?: number;
    invoices?: RawInvoicePayload[];
  };
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatPercent(value: number): string {
  const normalized = value > 1 ? value / 100 : value;
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(normalized);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDashboardData = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);

    fetch('/api/stats', { signal: AbortSignal.timeout(10_000) })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Ledgerly API request failed with status ' + res.status + '. The server was unable to return metrics.');
        }
        return res.json() as Promise<RawStatsPayload>;
      })
      .then((data) => {
        const statsNode = data.stats;
        const rawInvoices =
          data.invoices ??
          data.recentInvoices ??
          data.recent_invoices ??
          statsNode?.invoices ??
          [];

        const normalizedInvoices: Invoice[] = rawInvoices.slice(0, 10).map((inv, index) => {
          const customerName =
            typeof inv.customer === 'string'
              ? inv.customer
              : typeof inv.customer?.name === 'string'
                ? inv.customer.name
                : 'Account #' + (index + 101);

          return {
            id: inv.id ?? 'INV-' + (1001 + index),
            customer: customerName,
            amount: typeof inv.amount === 'number' ? inv.amount : 0,
            status: inv.status ?? 'pending',
            dueDate: inv.dueDate ?? inv.due_date ?? '2026-10-31',
          };
        });

        const mrr =
          data.monthlyRecurringRevenue ??
          data.monthly_recurring_revenue ??
          data.mrr ??
          data.revenue ??
          statsNode?.monthlyRecurringRevenue ??
          statsNode?.mrr ??
          statsNode?.revenue ??
          0;

        const activeCustomers =
          data.activeCustomers ??
          data.active_customers ??
          data.customers ??
          statsNode?.activeCustomers ??
          statsNode?.customers ??
          0;

        const churnRate =
          data.churnRate ??
          data.churn_rate ??
          data.churn ??
          statsNode?.churnRate ??
          statsNode?.churn ??
          0;

        setStats({
          monthlyRecurringRevenue: mrr,
          activeCustomers: activeCustomers,
          churnRate: churnRate,
          invoices: normalizedInvoices,
        });
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        const detail =
          err instanceof Error
            ? err.message
            : 'Network connection timed out or failed to reach the server.';
        setErrorMessage(
          'Failed to load ledger metrics from /api/stats. ' + detail + ' Verify your connection and retry the request.'
        );
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] font-[var(--font-text)] p-6 sm:p-8 lg:p-12">
      <div className="max-w-[1200px] mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-8 border-b border-[var(--line)] gap-4">
          <h1 className="font-[var(--font-display)] text-[clamp(1.953rem,3.05vw,2.441rem)] leading-[1.05] tracking-[-0.01em] text-[var(--ink)] font-semibold">
            Ledgerly Admin Dashboard
          </h1>
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="h-10 px-4 bg-[var(--accent)] text-[var(--on-accent)] rounded-[6px] font-[var(--font-mono)] text-sm tracking-wide transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:opacity-95 disabled:opacity-50"
          >
            Refresh metrics
          </button>
        </header>

        {errorMessage && (
          <div
            role="alert"
            className="mt-8 p-6 bg-[var(--surface)] border border-[var(--danger)] rounded-[6px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <p className="font-[var(--font-text)] text-sm leading-[1.6] text-[var(--danger)]">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="h-10 px-4 border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] rounded-[6px] font-[var(--font-mono)] text-sm shrink-0 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-[var(--surface-2)]"
            >
              Retry request
            </button>
          </div>
        )}

        <section aria-label="Core metrics" className="mt-8" aria-busy={isLoading}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <article className="bg-[var(--surface)] border border-[var(--line)] p-6 rounded-[6px]">
              <span className="font-[var(--font-mono)] text-xs uppercase tracking-wider text-[var(--ink-2)] block">
                Monthly Recurring Revenue
              </span>
              <p className="font-[var(--font-mono)] text-3xl font-semibold text-[var(--accent-ink)] mt-3 tabular-nums">
                {isLoading ? (
                  <span className="inline-block w-32 h-8 bg-[var(--surface-2)] animate-pulse rounded-none" aria-hidden="true" />
                ) : (
                  formatCurrency(stats?.monthlyRecurringRevenue ?? 0)
                )}
              </p>
            </article>

            <article className="bg-[var(--surface)] border border-[var(--line)] p-6 rounded-[6px]">
              <span className="font-[var(--font-mono)] text-xs uppercase tracking-wider text-[var(--ink-2)] block">
                Active Customers
              </span>
              <p className="font-[var(--font-mono)] text-3xl font-semibold text-[var(--ink)] mt-3 tabular-nums">
                {isLoading ? (
                  <span className="inline-block w-20 h-8 bg-[var(--surface-2)] animate-pulse rounded-none" aria-hidden="true" />
                ) : (
                  formatCount(stats?.activeCustomers ?? 0)
                )}
              </p>
            </article>

            <article className="bg-[var(--surface)] border border-[var(--line)] p-6 rounded-[6px]">
              <span className="font-[var(--font-mono)] text-xs uppercase tracking-wider text-[var(--ink-2)] block">
                Churn Rate
              </span>
              <p className="font-[var(--font-mono)] text-3xl font-semibold text-[var(--ink)] mt-3 tabular-nums">
                {isLoading ? (
                  <span className="inline-block w-20 h-8 bg-[var(--surface-2)] animate-pulse rounded-none" aria-hidden="true" />
                ) : (
                  formatPercent(stats?.churnRate ?? 0)
                )}
              </p>
            </article>
          </div>
        </section>

        <section aria-label="Recent invoices" className="mt-12">
          <div className="pb-4">
            <h2 className="font-[var(--font-display)] text-2xl tracking-[-0.01em] text-[var(--ink)] font-semibold">
              Recent Invoices
            </h2>
          </div>

          <div className="overflow-x-auto w-full border border-[var(--line)] bg-[var(--surface)] rounded-[6px]">
            <table className="w-full text-left border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-2)]">
                  <th scope="col" className="py-3 px-4 font-[var(--font-mono)] text-xs uppercase tracking-wider text-[var(--ink-2)]">
                    Customer
                  </th>
                  <th scope="col" className="py-3 px-4 font-[var(--font-mono)] text-xs uppercase tracking-wider text-[var(--ink-2)] text-right">
                    Amount
                  </th>
                  <th scope="col" className="py-3 px-4 font-[var(--font-mono)] text-xs uppercase tracking-wider text-[var(--ink-2)]">
                    Status
                  </th>
                  <th scope="col" className="py-3 px-4 font-[var(--font-mono)] text-xs uppercase tracking-wider text-[var(--ink-2)] text-right">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]" aria-busy={isLoading}>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={'skeleton-' + index} className="border-b border-[var(--line)]">
                      <td className="py-4 px-4">
                        <div className="w-32 h-4 bg-[var(--surface-2)] animate-pulse rounded-none" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="w-16 h-4 bg-[var(--surface-2)] animate-pulse rounded-none ml-auto" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="w-12 h-4 bg-[var(--surface-2)] animate-pulse rounded-none" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="w-20 h-4 bg-[var(--surface-2)] animate-pulse rounded-none ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : (stats?.invoices.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 px-4 text-center font-[var(--font-mono)] text-sm text-[var(--ink-2)]">
                      No invoices recorded in this billing cycle.
                    </td>
                  </tr>
                ) : (
                  stats?.invoices.map((invoice) => {
                    const statusLower = invoice.status.toLowerCase();
                    const statusClass =
                      statusLower === 'paid'
                        ? 'text-[var(--ok)]'
                        : statusLower === 'overdue'
                          ? 'text-[var(--danger)]'
                          : 'text-[var(--warn)]';

                    return (
                      <tr
                        key={invoice.id}
                        className="hover:bg-[var(--surface-2)] transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
                      >
                        <td className="py-4 px-4 font-[var(--font-text)] text-[var(--ink)] text-sm">
                          {invoice.customer}
                        </td>
                        <td className="py-4 px-4 font-[var(--font-mono)] text-[var(--ink)] text-sm text-right tabular-nums">
                          {formatCurrency(invoice.amount)}
                        </td>
                        <td className="py-4 px-4 font-[var(--font-mono)] text-xs uppercase tracking-wide">
                          <span className={statusClass}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-[var(--font-mono)] text-[var(--ink-2)] text-sm text-right tabular-nums">
                          {invoice.dueDate}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Dashboard;
