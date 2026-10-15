import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CustomerObject {
  name: string;
  email?: string;
  avatarUrl?: string;
  [key: string]: unknown;
}

export interface Invoice {
  id?: string | number;
  customer?: string | CustomerObject;
  customerName?: string;
  customerEmail?: string;
  amount: number | string;
  status: 'paid' | 'pending' | 'overdue' | 'draft' | 'unpaid' | 'cancelled' | string;
  dueDate?: string;
  due_date?: string;
  date?: string;
  createdAt?: string;
}

export interface DashboardStats {
  monthlyRecurringRevenue?: number | string;
  mrr?: number | string;
  monthly_recurring_revenue?: number | string;

  activeCustomers?: number | string;
  active_customers?: number | string;
  totalCustomers?: number | string;

  churnRate?: number | string;
  churn_rate?: number | string;

  invoices?: Invoice[];
  recentInvoices?: Invoice[];
  recent_invoices?: Invoice[];
}

// ============================================================================
// Formatting Helpers
// ============================================================================

const formatCurrency = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '$0.00';
  const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]+/g, '')) : val;
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatNumber = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]+/g, '')) : val;
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat('en-US').format(num);
};

const formatPercent = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.0%';
  if (typeof val === 'string' && val.includes('%')) return val;
  const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]+/g, '')) : val;
  if (isNaN(num)) return String(val);
  // Support both decimal ratio (e.g. 0.024 -> 2.4%) and percentage number (e.g. 2.4 -> 2.4%)
  const percentage = num > 0 && num < 0.25 ? num * 100 : num;
  return `${percentage.toFixed(1)}%`;
};

const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return String(dateStr);
  }
};

const getCustomerInfo = (invoice: Invoice): { name: string; email: string; initials: string } => {
  let name = 'Unknown Customer';
  let email = '';

  if (typeof invoice.customer === 'string' && invoice.customer.trim()) {
    name = invoice.customer.trim();
  } else if (invoice.customer && typeof invoice.customer === 'object') {
    if (invoice.customer.name) name = invoice.customer.name;
    if (invoice.customer.email) email = invoice.customer.email;
  } else if (invoice.customerName) {
    name = invoice.customerName;
  }

  if (!email && invoice.customerEmail) {
    email = invoice.customerEmail;
  }

  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2 
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase() || 'CU';

  return { name, email, initials };
};

const getStatusBadge = (status: string | undefined | null) => {
  const normalized = (status || 'unknown').toLowerCase().trim();
  switch (normalized) {
    case 'paid':
    case 'completed':
      return {
        label: 'Paid',
        containerClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/10',
        dotClass: 'bg-emerald-500',
      };
    case 'pending':
    case 'open':
    case 'processing':
      return {
        label: 'Pending',
        containerClass: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-600/10',
        dotClass: 'bg-amber-500',
      };
    case 'overdue':
    case 'failed':
      return {
        label: 'Overdue',
        containerClass: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-600/10',
        dotClass: 'bg-rose-500',
      };
    case 'draft':
      return {
        label: 'Draft',
        containerClass: 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-600/10',
        dotClass: 'bg-slate-400',
      };
    default:
      return {
        label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown',
        containerClass: 'bg-slate-100 text-slate-700 border-slate-200 ring-slate-600/10',
        dotClass: 'bg-slate-400',
      };
  }
};

// ============================================================================
// Main Component
// ============================================================================

export default function Dashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/stats', { signal });
      if (!response.ok) {
        throw new Error(`Failed to load stats: ${response.status} ${response.statusText}`);
      }
      const json: DashboardStats = await response.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while fetching dashboard data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [fetchStats]);

  // Derived normalized values
  const mrrValue = data?.monthlyRecurringRevenue ?? data?.mrr ?? data?.monthly_recurring_revenue ?? 0;
  const activeCustomersValue = data?.activeCustomers ?? data?.active_customers ?? data?.totalCustomers ?? 0;
  const churnRateValue = data?.churnRate ?? data?.churn_rate ?? 0;
  
  const rawInvoices = data?.recentInvoices ?? data?.invoices ?? data?.recent_invoices ?? [];
  const recentInvoices: Invoice[] = Array.isArray(rawInvoices) ? rawInvoices.slice(0, 10) : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">Ledgerly</h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Admin
                  </span>
                </div>
                <p className="text-xs text-slate-500">Financial overview and customer billing</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {lastRefreshed && (
                <span className="hidden sm:inline-block text-xs text-slate-500">
                  Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
              <button
                type="button"
                onClick={() => fetchStats()}
                disabled={loading}
                className="inline-flex items-center px-3.5 py-2 border border-slate-200 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs transition-colors"
                title="Refresh dashboard stats"
              >
                <svg
                  className={`w-4 h-4 mr-2 text-slate-500 ${loading ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Error Notification */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-xs" role="alert">
            <div className="flex items-start">
              <div className="shrink-0 text-rose-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 flex-1 md:flex md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-rose-900">Failed to load dashboard metrics</h3>
                  <p className="mt-1 text-sm text-rose-700">{error}</p>
                </div>
                <div className="mt-3 md:mt-0 md:ml-6 flex items-center">
                  <button
                    type="button"
                    onClick={() => fetchStats()}
                    className="inline-flex items-center px-3 py-1.5 border border-rose-300 text-xs font-semibold rounded-md text-rose-800 bg-white hover:bg-rose-50 shadow-xs transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stat Cards Grid */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="sr-only">Key Performance Indicators</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Stat Card 1: Monthly Recurring Revenue */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Monthly Recurring Revenue</span>
                <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                {loading && !data ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-8 bg-slate-200 rounded w-36"></div>
                    <div className="h-4 bg-slate-100 rounded w-24"></div>
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                      {formatCurrency(mrrValue)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 flex items-center">
                      <span className="text-emerald-600 font-semibold inline-flex items-center mr-1">
                        <svg className="w-3.5 h-3.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                        MRR
                      </span>
                      total recurring revenue
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Stat Card 2: Active Customers */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Active Customers</span>
                <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                {loading && !data ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-8 bg-slate-200 rounded w-28"></div>
                    <div className="h-4 bg-slate-100 rounded w-20"></div>
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                      {formatNumber(activeCustomersValue)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Subscribed accounts</p>
                  </>
                )}
              </div>
            </div>

            {/* Stat Card 3: Churn Rate */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Churn Rate</span>
                <span className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                {loading && !data ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-8 bg-slate-200 rounded w-24"></div>
                    <div className="h-4 bg-slate-100 rounded w-28"></div>
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                      {formatPercent(churnRateValue)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Monthly customer churn</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Recent Invoices Section */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent Invoices</h2>
              <p className="text-xs text-slate-500 mt-0.5">Showing the 10 most recent invoices</p>
            </div>
            {!loading && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 self-start sm:self-auto">
                {recentInvoices.length} {recentInvoices.length === 1 ? 'record' : 'records'}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/80">
                <tr>
                  <th scope="col" className="py-3.5 pl-6 pr-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="py-3.5 pl-3 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/75 bg-white">
                {loading && !data ? (
                  // Skeleton loader rows
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="py-4 pl-6 pr-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0"></div>
                          <div className="ml-3 space-y-1.5">
                            <div className="h-4 bg-slate-200 rounded w-28"></div>
                            <div className="h-3 bg-slate-100 rounded w-40"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="h-4 bg-slate-200 rounded w-20"></div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="h-6 bg-slate-200 rounded-full w-16"></div>
                      </td>
                      <td className="py-4 pl-3 pr-6 whitespace-nowrap">
                        <div className="h-4 bg-slate-200 rounded w-24"></div>
                      </td>
                    </tr>
                  ))
                ) : recentInvoices.length > 0 ? (
                  // Invoices records
                  recentInvoices.map((invoice, index) => {
                    const { name, email, initials } = getCustomerInfo(invoice);
                    const statusConfig = getStatusBadge(invoice.status);
                    const rawDueDate = invoice.dueDate || invoice.due_date || invoice.date;
                    const invoiceKey = invoice.id ? String(invoice.id) : `invoice-${index}`;

                    return (
                      <tr key={invoiceKey} className="hover:bg-slate-50/70 transition-colors">
                        {/* Customer */}
                        <td className="py-4 pl-6 pr-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div className="ml-3">
                              <div className="font-medium text-slate-900">{name}</div>
                              {email ? (
                                <div className="text-xs text-slate-500">{email}</div>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(invoice.amount)}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ring-1 ring-inset ${statusConfig.containerClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusConfig.dotClass}`} />
                            {statusConfig.label}
                          </span>
                        </td>

                        {/* Due Date */}
                        <td className="py-4 pl-3 pr-6 whitespace-nowrap text-sm text-slate-600">
                          {formatDate(rawDueDate)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  // Empty State
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <div className="mx-auto flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-900">No invoices found</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          There are currently no recorded recent invoices to display.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

// Named export support
export { Dashboard };
