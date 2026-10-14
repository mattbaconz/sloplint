import React, { useEffect, useState } from 'react';

export interface Invoice {
  id: string | number;
  customer: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'draft' | string;
  dueDate: string;
}

export interface DashboardStats {
  monthlyRecurringRevenue: number;
  activeCustomers: number;
  churnRate: number;
  invoices: Invoice[];
}

function normalizeStats(raw: unknown): DashboardStats {
  const root = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const payload = (typeof root.data === 'object' && root.data !== null ? root.data : root) as Record<string, unknown>;
  const statsSource = (typeof payload.stats === 'object' && payload.stats !== null ? payload.stats : payload) as Record<string, unknown>;

  const mrrVal = statsSource.monthlyRecurringRevenue ?? statsSource.monthly_recurring_revenue ?? statsSource.mrr ?? 0;
  const activeVal = statsSource.activeCustomers ?? statsSource.active_customers ?? statsSource.customers ?? 0;
  const churnVal = statsSource.churnRate ?? statsSource.churn_rate ?? 0;

  const rawInvoices = Array.isArray(payload.invoices)
    ? payload.invoices
    : Array.isArray(payload.recentInvoices)
    ? payload.recentInvoices
    : Array.isArray(payload.recent_invoices)
    ? payload.recent_invoices
    : Array.isArray(statsSource.invoices)
    ? statsSource.invoices
    : [];

  const invoices: Invoice[] = rawInvoices.map((inv: unknown, index: number) => {
    const item = (typeof inv === 'object' && inv !== null ? inv : {}) as Record<string, unknown>;

    let customerName = 'Customer';
    if (typeof item.customer === 'string') {
      customerName = item.customer;
    } else if (typeof item.customer === 'object' && item.customer !== null) {
      const custObj = item.customer as Record<string, unknown>;
      if (typeof custObj.name === 'string') {
        customerName = custObj.name;
      }
    } else if (typeof item.customerName === 'string') {
      customerName = item.customerName;
    } else if (typeof item.customer_name === 'string') {
      customerName = item.customer_name;
    }

    const amountNum = typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0;
    const statusStr = typeof item.status === 'string' ? item.status.toLowerCase() : 'pending';
    const dueDateStr = String(item.dueDate ?? item.due_date ?? item.date ?? '');

    return {
      id: (item.id as string | number) ?? `inv-${index}`,
      customer: customerName,
      amount: amountNum,
      status: statusStr,
      dueDate: dueDateStr,
    };
  });

  return {
    monthlyRecurringRevenue: typeof mrrVal === 'number' ? mrrVal : Number(mrrVal) || 0,
    activeCustomers: typeof activeVal === 'number' ? activeVal : Number(activeVal) || 0,
    churnRate: typeof churnVal === 'number' ? churnVal : Number(churnVal) || 0,
    invoices,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatInvoiceAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number): string {
  const normalized = value > 0 && value < 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  });
}

function renderStatus(status: string) {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'paid':
      return (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#5fbf8f]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5fbf8f]" aria-hidden="true" />
          Paid
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#e6c15a]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#e6c15a]" aria-hidden="true" />
          Pending
        </span>
      );
    case 'overdue':
      return (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#ef6b5b]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ef6b5b]" aria-hidden="true" />
          Overdue
        </span>
      );
    case 'draft':
      return (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#9a9ea6]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9a9ea6]" aria-hidden="true" />
          Draft
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#9a9ea6]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9a9ea6]" aria-hidden="true" />
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
        </span>
      );
  }
}

export function Dashboard(): React.ReactElement {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadDashboardStats() {
      setLoading(true);
      setError(null);

      try {
        const timeoutSignal = AbortSignal.timeout(10_000);
        const signal = typeof AbortSignal.any === 'function'
          ? AbortSignal.any([controller.signal, timeoutSignal])
          : controller.signal;

        const response = await fetch('/api/stats', { signal });
        if (!response.ok) {
          throw new Error(`Server returned HTTP status ${response.status} (${response.statusText || 'Request failed'})`);
        }
        const json = await response.json();
        if (isMounted) {
          setStats(normalizeStats(json));
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
          if (controller.signal.aborted) return;
          setError('Request timed out after 10 seconds. Check server responsiveness and retry.');
          return;
        }
        const message = err instanceof Error ? err.message : 'Network communication failure';
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardStats();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [reloadTrigger]);

  function handleReload() {
    setReloadTrigger((prev) => prev + 1);
  }

  const recentInvoices = (stats?.invoices ?? []).slice(0, 10);

  return (
    <div className="min-h-screen bg-[#0e0f11] text-[#e8e6e1] font-sans antialiased tabular-nums p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#2a2e34]">
          <h1 className="text-[28px] font-semibold leading-tight text-[#e8e6e1]">
            Ledgerly Admin
          </h1>
          <button
            type="button"
            onClick={handleReload}
            disabled={loading}
            className="h-8 px-3 rounded-[6px] border border-[#2a2e34] bg-transparent text-[#e8e6e1] text-[12px] font-medium hover:bg-[#1c1f23] disabled:opacity-50 transition-colors duration-150 ease-out"
          >
            Refresh statistics
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="border border-[#ef6b5b]/40 bg-[#ef6b5b]/10 p-4 text-[#e8e6e1] text-[14px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#ef6b5b] mt-1.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-[#ef6b5b]">Failed to load statistics from /api/stats.</p>
                <p className="text-[12px] text-[#9a9ea6] mt-0.5">{error}. Check network connectivity and server status.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReload}
              className="h-8 px-3 bg-[#f2a33a] text-[#1a1206] text-[12px] font-medium rounded-[6px] hover:bg-[#e09228] transition-colors duration-150 ease-out shrink-0"
            >
              Retry loading statistics
            </button>
          </div>
        )}

        <section aria-busy={loading} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#15171a] border border-[#2a2e34] rounded-[6px] p-4 tabular-nums">
            <div className="text-[12px] leading-4 font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
              Monthly Recurring Revenue
            </div>
            <div className="mt-2 text-[28px] font-semibold text-[#e8e6e1] font-mono tabular-nums leading-tight">
              {loading ? (
                <div className="h-7 w-32 bg-[#1c1f23] animate-pulse my-0.5" />
              ) : (
                formatCurrency(stats?.monthlyRecurringRevenue ?? 0)
              )}
            </div>
          </div>

          <div className="bg-[#15171a] border border-[#2a2e34] rounded-[6px] p-4 tabular-nums">
            <div className="text-[12px] leading-4 font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
              Active Customers
            </div>
            <div className="mt-2 text-[28px] font-semibold text-[#e8e6e1] font-mono tabular-nums leading-tight">
              {loading ? (
                <div className="h-7 w-20 bg-[#1c1f23] animate-pulse my-0.5" />
              ) : (
                formatNumber(stats?.activeCustomers ?? 0)
              )}
            </div>
          </div>

          <div className="bg-[#15171a] border border-[#2a2e34] rounded-[6px] p-4 tabular-nums">
            <div className="text-[12px] leading-4 font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
              Churn Rate
            </div>
            <div className="mt-2 text-[28px] font-semibold text-[#e8e6e1] font-mono tabular-nums leading-tight">
              {loading ? (
                <div className="h-7 w-16 bg-[#1c1f23] animate-pulse my-0.5" />
              ) : (
                formatPercent(stats?.churnRate ?? 0)
              )}
            </div>
          </div>
        </section>

        <section aria-busy={loading} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold leading-tight text-[#e8e6e1]">
              Recent Invoices
            </h2>
            <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#9a9ea6] font-mono tabular-nums">
              10 latest entries
            </span>
          </div>

          <div className="border border-[#2a2e34] bg-[#15171a] rounded-[6px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left font-mono tabular-nums">
                <thead className="sticky top-0 bg-[#15171a]">
                  <tr className="h-8">
                    <th scope="col" className="h-8 px-4 text-left text-[12px] leading-4 font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
                      Customer
                    </th>
                    <th scope="col" className="h-8 px-4 text-right text-[12px] leading-4 font-medium uppercase tracking-[0.06em] text-[#9a9ea6] font-mono tabular-nums">
                      Amount
                    </th>
                    <th scope="col" className="h-8 px-4 text-left text-[12px] leading-4 font-medium uppercase tracking-[0.06em] text-[#9a9ea6]">
                      Status
                    </th>
                    <th scope="col" className="h-8 px-4 text-right text-[12px] leading-4 font-medium uppercase tracking-[0.06em] text-[#9a9ea6] font-mono tabular-nums">
                      Due Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2e34]">
                  {loading ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <tr key={`skeleton-row-${index}`} className="h-8 border-t border-[#2a2e34]">
                        <td className="h-8 px-4">
                          <div className="h-3.5 w-32 bg-[#1c1f23] animate-pulse" />
                        </td>
                        <td className="h-8 px-4 text-right tabular-nums">
                          <div className="h-3.5 w-16 bg-[#1c1f23] animate-pulse ml-auto" />
                        </td>
                        <td className="h-8 px-4">
                          <div className="h-3.5 w-16 bg-[#1c1f23] animate-pulse" />
                        </td>
                        <td className="h-8 px-4 text-right tabular-nums">
                          <div className="h-3.5 w-20 bg-[#1c1f23] animate-pulse ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : recentInvoices.length === 0 ? (
                    <tr className="border-t border-[#2a2e34]">
                      <td colSpan={4} className="h-16 px-4 text-center text-[14px] text-[#9a9ea6]">
                        No recent invoices found. New customer billings will appear here.
                      </td>
                    </tr>
                  ) : (
                    recentInvoices.map((invoice: Invoice) => (
                      <tr
                        key={invoice.id}
                        className="h-8 border-t border-[#2a2e34] hover:bg-[#1c1f23] transition-colors duration-150 ease-out"
                      >
                        <td className="h-8 px-4 text-[14px] text-[#e8e6e1] font-sans truncate max-w-[220px]">
                          {invoice.customer}
                        </td>
                        <td className="h-8 px-4 text-right text-[14px] font-mono tabular-nums text-[#e8e6e1]">
                          {formatInvoiceAmount(invoice.amount)}
                        </td>
                        <td className="h-8 px-4 font-sans">
                          {renderStatus(invoice.status)}
                        </td>
                        <td className="h-8 px-4 text-right text-[14px] font-mono tabular-nums text-[#9a9ea6]">
                          {formatDate(invoice.dueDate)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
