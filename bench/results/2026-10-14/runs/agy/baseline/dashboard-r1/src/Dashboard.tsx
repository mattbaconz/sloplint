import React, { useState, useEffect, useCallback } from 'react';

export interface Invoice {
  id?: string | number;
  customer?: string | { name?: string; email?: string; company?: string };
  customerName?: string;
  customer_name?: string;
  customerEmail?: string;
  customer_email?: string;
  amount: number | string;
  status: 'paid' | 'pending' | 'overdue' | 'draft' | string;
  dueDate?: string;
  due_date?: string;
  date?: string;
}

export interface StatsResponse {
  monthlyRecurringRevenue?: number | string;
  monthly_recurring_revenue?: number | string;
  mrr?: number | string;
  activeCustomers?: number | string;
  active_customers?: number | string;
  customers?: number | string;
  churnRate?: number | string;
  churn_rate?: number | string;
  invoices?: Invoice[];
  recentInvoices?: Invoice[];
  recent_invoices?: Invoice[];
}

export default function Dashboard() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stats', { signal });

      if (!response.ok) {
        throw new Error(`Failed to load stats (${response.status}: ${response.statusText || 'Server Error'})`);
      }

      const result: StatsResponse = await response.json();
      setData(result);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while fetching dashboard data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchStats]);

  // Formatters & normalizers
  const formatMRR = (val?: number | string) => {
    if (val === undefined || val === null) return '$0.00';
    if (typeof val === 'number') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: val % 1 === 0 ? 0 : 2,
      }).format(val);
    }
    const num = Number(val);
    if (!isNaN(num) && val !== '') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: num % 1 === 0 ? 0 : 2,
      }).format(num);
    }
    return String(val);
  };

  const formatCustomers = (val?: number | string) => {
    if (val === undefined || val === null) return '0';
    if (typeof val === 'number') {
      return new Intl.NumberFormat('en-US').format(val);
    }
    const num = Number(val);
    if (!isNaN(num) && val !== '') {
      return new Intl.NumberFormat('en-US').format(num);
    }
    return String(val);
  };

  const formatChurn = (val?: number | string) => {
    if (val === undefined || val === null) return '0.0%';
    if (typeof val === 'number') {
      return `${val.toFixed(1)}%`;
    }
    if (typeof val === 'string') {
      return val.includes('%') ? val : `${val}%`;
    }
    return String(val);
  };

  const formatAmount = (val?: number | string) => {
    if (val === undefined || val === null) return '$0.00';
    if (typeof val === 'number') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(val);
    }
    const num = Number(val);
    if (!isNaN(num) && val !== '') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    }
    return String(val);
  };

  const formatDueDate = (invoice: Invoice) => {
    const rawDate = invoice.dueDate || invoice.due_date || invoice.date;
    if (!rawDate) return '—';
    const parsed = new Date(rawDate);
    if (isNaN(parsed.getTime())) return String(rawDate);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(parsed);
  };

  const getCustomerInfo = (invoice: Invoice) => {
    if (typeof invoice.customer === 'string') {
      return {
        name: invoice.customer,
        email: invoice.customerEmail || invoice.customer_email || null,
      };
    }
    if (invoice.customer && typeof invoice.customer === 'object') {
      return {
        name: invoice.customer.name || invoice.customer.company || 'Unknown Customer',
        email: invoice.customer.email || invoice.customerEmail || invoice.customer_email || null,
      };
    }
    return {
      name: invoice.customerName || invoice.customer_name || 'Unknown Customer',
      email: invoice.customerEmail || invoice.customer_email || null,
    };
  };

  const getStatusBadge = (status: string) => {
    const normalized = (status || '').toLowerCase().trim();

    switch (normalized) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Paid
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Pending
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/20 capitalize">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            {status || 'Draft'}
          </span>
        );
    }
  };

  // Extract stats
  const mrrValue = data?.monthlyRecurringRevenue ?? data?.monthly_recurring_revenue ?? data?.mrr;
  const activeCustomersValue = data?.activeCustomers ?? data?.active_customers ?? data?.customers;
  const churnRateValue = data?.churnRate ?? data?.churn_rate;
  const rawInvoices = data?.invoices ?? data?.recentInvoices ?? data?.recent_invoices ?? [];
  const recentInvoices = Array.isArray(rawInvoices) ? rawInvoices.slice(0, 10) : [];

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 lg:p-10 font-sans antialiased text-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ledgerly</h1>
                <p className="text-sm text-slate-500">Admin Dashboard &amp; Financial Overview</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStats()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <svg
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.03 8.03 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="font-semibold text-sm">Failed to load dashboard data</p>
                <p className="text-xs text-rose-600">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchStats()}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition shadow-sm self-start sm:self-auto"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stat Cards */}
        {isLoading && !data ? (
          /* Loading Skeletons for Stat Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-10 w-10 bg-slate-200 rounded-xl" />
                </div>
                <div className="h-8 bg-slate-200 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Monthly Recurring Revenue */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Monthly Recurring Revenue
                </span>
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {formatMRR(mrrValue)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Current annualized run rate component</p>
            </div>

            {/* Active Customers */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Customers
                </span>
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {formatCustomers(activeCustomersValue)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Total subscribed and paying accounts</p>
            </div>

            {/* Churn Rate */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Churn Rate
                </span>
                <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {formatChurn(churnRateValue)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Monthly customer attrition rate</p>
            </div>
          </div>
        )}

        {/* Recent Invoices Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent Invoices</h2>
              <p className="text-xs text-slate-500 mt-1">
                Showing the 10 most recent invoices and payment records
              </p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 self-start sm:self-auto">
              {recentInvoices.length} {recentInvoices.length === 1 ? 'Invoice' : 'Invoices'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th scope="col" className="py-3.5 px-6">
                    Customer
                  </th>
                  <th scope="col" className="py-3.5 px-6">
                    Amount
                  </th>
                  <th scope="col" className="py-3.5 px-6">
                    Status
                  </th>
                  <th scope="col" className="py-3.5 px-6">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {isLoading && !data ? (
                  /* Loading skeleton rows */
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-6">
                        <div className="h-4 bg-slate-200 rounded w-36 mb-2" />
                        <div className="h-3 bg-slate-100 rounded w-24" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-4 bg-slate-200 rounded w-16" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-6 bg-slate-200 rounded-full w-20" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-4 bg-slate-200 rounded w-24" />
                      </td>
                    </tr>
                  ))
                ) : recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500">
                      <svg
                        className="mx-auto h-10 w-10 text-slate-400 mb-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="font-medium text-slate-600">No invoices found</p>
                      <p className="text-xs text-slate-400 mt-1">New invoices will appear here once generated.</p>
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map((invoice, index) => {
                    const { name, email } = getCustomerInfo(invoice);
                    const invoiceKey = invoice.id ?? `${name}-${index}`;

                    return (
                      <tr
                        key={invoiceKey}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <div className="font-semibold text-slate-900">{name}</div>
                          {email && (
                            <div className="text-xs text-slate-500 mt-0.5">{email}</div>
                          )}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          {formatAmount(invoice.amount)}
                        </td>
                        <td className="py-4 px-6">
                          {getStatusBadge(invoice.status)}
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-medium">
                          {formatDueDate(invoice)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Dashboard };
