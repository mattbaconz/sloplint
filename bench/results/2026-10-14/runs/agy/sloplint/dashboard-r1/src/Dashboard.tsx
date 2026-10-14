import React, { useState, useEffect, useCallback } from 'react';

export interface Invoice {
  id: string | number;
  customer: string;
  amount: number;
  status: string;
  dueDate: string;
}

interface RawInvoice {
  id?: string | number;
  customer?: string;
  customerName?: string;
  customer_name?: string;
  amount?: number;
  total?: number;
  status?: string;
  dueDate?: string;
  due_date?: string;
}

interface StatsApiResponse {
  monthlyRecurringRevenue?: number;
  monthly_recurring_revenue?: number;
  mrr?: number;
  activeCustomers?: number;
  active_customers?: number;
  customers?: number;
  churnRate?: number;
  churn_rate?: number;
  churn?: number;
  invoices?: RawInvoice[];
  recentInvoices?: RawInvoice[];
  recent_invoices?: RawInvoice[];
  stats?: {
    monthlyRecurringRevenue?: number;
    monthly_recurring_revenue?: number;
    mrr?: number;
    activeCustomers?: number;
    active_customers?: number;
    customers?: number;
    churnRate?: number;
    churn_rate?: number;
    churn?: number;
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number): string {
  const normalized = value > 0 && value < 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

function formatDate(dateString: string): string {
  if (!dateString) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) return dateString;
  return parsed.toISOString().split('T')[0];
}

function StatusIndicator({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  let colorClass = 'text-[#9a9ea6]';
  let dotClass = 'bg-[#9a9ea6]';
  let label = status;

  if (normalized === 'paid') {
    colorClass = 'text-[#5fbf8f]';
    dotClass = 'bg-[#5fbf8f]';
    label = 'Paid';
  } else if (normalized === 'pending') {
    colorClass = 'text-[#e6c15a]';
    dotClass = 'bg-[#e6c15a]';
    label = 'Pending';
  } else if (normalized === 'overdue') {
    colorClass = 'text-[#ef6b5b]';
    dotClass = 'bg-[#ef6b5b]';
    label = 'Overdue';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.06em] ${colorClass}`}>
      <span className={`inline-block h-1.5 w-1.5 ${dotClass}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function Dashboard() {
  const [data, setData] = useState<StatsApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/stats', { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText || 'request failed'}`);
      }
      const json: StatsApiResponse = await response.json();
      setData(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const mrr =
    data?.monthlyRecurringRevenue ??
    data?.monthly_recurring_revenue ??
    data?.mrr ??
    data?.stats?.monthlyRecurringRevenue ??
    data?.stats?.monthly_recurring_revenue ??
    data?.stats?.mrr ??
    0;

  const activeCustomers =
    data?.activeCustomers ??
    data?.active_customers ??
    data?.customers ??
    data?.stats?.activeCustomers ??
    data?.stats?.active_customers ??
    data?.stats?.customers ??
    0;

  const churnRate =
    data?.churnRate ??
    data?.churn_rate ??
    data?.churn ??
    data?.stats?.churnRate ??
    data?.stats?.churn_rate ??
    data?.stats?.churn ??
    0;

  const rawInvoices =
    data?.invoices ??
    data?.recentInvoices ??
    data?.recent_invoices ??
    [];

  const invoices: Invoice[] = rawInvoices.slice(0, 10).map((item, index) => ({
    id: item.id ?? `inv-${index + 1}`,
    customer: item.customer || item.customerName || item.customer_name || 'Account',
    amount: typeof item.amount === 'number' ? item.amount : (typeof item.total === 'number' ? item.total : 0),
    status: item.status || 'pending',
    dueDate: item.dueDate || item.due_date || '',
  }));

  return (
    <main className="min-h-screen bg-[#0e0f11] p-6 text-[#e8e6e1] font-sans">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-[20px] font-semibold leading-tight text-[#e8e6e1]">
            Ledgerly Admin
          </h1>
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            aria-busy={loading}
            className="relative inline-flex h-8 items-center justify-center rounded-[6px] border border-[#2a2e34] bg-transparent px-3 text-xs font-medium uppercase tracking-[0.06em] text-[#e8e6e1] transition-colors duration-150 ease-out hover:bg-[#1c1f23] disabled:cursor-not-allowed"
          >
            <span className={loading ? 'invisible' : undefined}>Reload metrics</span>
            {loading && (
              <svg
                className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-[#f2a33a]"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-[6px] border border-[#ef6b5b]/30 bg-[#ef6b5b]/10 p-4 text-sm text-[#e8e6e1]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-[#ef6b5b]">
                  Telemetry query failed for /api/stats
                </p>
                <p className="mt-1 text-xs text-[#9a9ea6]">
                  {error}. Verify service availability and retry request.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchStats}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-none bg-[#f2a33a] px-3 text-xs font-medium uppercase tracking-[0.06em] text-[#1a1206] transition-colors duration-150 ease-out hover:bg-[#d88f30]"
              >
                Retry request
              </button>
            </div>
          </div>
        )}

        <section
          aria-label="Key performance metrics"
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <div className="rounded-[6px] border border-[#2a2e34] bg-[#15171a] p-4">
            <span className="text-xs font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
              Monthly Recurring Revenue
            </span>
            <div className="mt-2 font-mono text-[28px] font-semibold leading-tight text-[#e8e6e1] tabular-nums">
              {loading ? (
                <div className="h-7 w-32 animate-pulse bg-[#1c1f23]" aria-hidden="true" />
              ) : (
                formatCurrency(mrr)
              )}
            </div>
          </div>

          <div className="rounded-[6px] border border-[#2a2e34] bg-[#15171a] p-4">
            <span className="text-xs font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
              Active Customers
            </span>
            <div className="mt-2 font-mono text-[28px] font-semibold leading-tight text-[#e8e6e1] tabular-nums">
              {loading ? (
                <div className="h-7 w-20 animate-pulse bg-[#1c1f23]" aria-hidden="true" />
              ) : (
                formatNumber(activeCustomers)
              )}
            </div>
          </div>

          <div className="rounded-[6px] border border-[#2a2e34] bg-[#15171a] p-4">
            <span className="text-xs font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
              Churn Rate
            </span>
            <div className="mt-2 font-mono text-[28px] font-semibold leading-tight text-[#e8e6e1] tabular-nums">
              {loading ? (
                <div className="h-7 w-16 animate-pulse bg-[#1c1f23]" aria-hidden="true" />
              ) : (
                formatPercent(churnRate)
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[6px] border border-[#2a2e34] bg-[#15171a]">
          <div className="border-b border-[#2a2e34] px-4 py-3">
            <h2 className="text-base font-semibold leading-tight text-[#e8e6e1]">
              Recent Invoices
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-sm tabular-nums">
              <thead>
                <tr className="h-[32px] bg-[#15171a] text-xs font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
                  <th scope="col" className="px-4 font-medium">Customer</th>
                  <th scope="col" className="px-4 text-right font-medium">Amount</th>
                  <th scope="col" className="px-4 font-medium">Status</th>
                  <th scope="col" className="px-4 text-right font-medium">Due Date</th>
                </tr>
              </thead>
              <tbody aria-busy={loading} className="divide-y divide-[#2a2e34]">
                {loading ? (
                  Array.from({ length: 10 }).map((_, index) => (
                    <tr key={`invoice-skeleton-${index}`} className="h-[32px]">
                      <td className="px-4">
                        <div className="h-3.5 w-32 animate-pulse bg-[#1c1f23]" />
                      </td>
                      <td className="px-4 text-right">
                        <div className="ml-auto h-3.5 w-16 animate-pulse bg-[#1c1f23]" />
                      </td>
                      <td className="px-4">
                        <div className="h-3.5 w-14 animate-pulse bg-[#1c1f23]" />
                      </td>
                      <td className="px-4 text-right">
                        <div className="ml-auto h-3.5 w-20 animate-pulse bg-[#1c1f23]" />
                      </td>
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="h-16 text-center text-xs text-[#9a9ea6]">
                      No recent invoices found in ledger.
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="h-[32px] transition-colors duration-150 ease-out hover:bg-[#1c1f23]"
                    >
                      <td className="px-4 font-sans text-sm text-[#e8e6e1]">
                        {invoice.customer}
                      </td>
                      <td className="px-4 text-right font-mono text-sm text-[#e8e6e1] tabular-nums">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="px-4">
                        <StatusIndicator status={invoice.status} />
                      </td>
                      <td className="px-4 text-right font-mono text-xs text-[#9a9ea6] tabular-nums">
                        {formatDate(invoice.dueDate)}
                      </td>
                    </tr>
                  ))
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
