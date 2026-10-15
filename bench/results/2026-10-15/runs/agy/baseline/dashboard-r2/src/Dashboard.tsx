import React, { useState, useEffect, useCallback } from 'react';

export interface Invoice {
  id?: string | number;
  customer: string | { name: string; email?: string };
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'draft' | string;
  dueDate?: string;
  due_date?: string;
}

export interface DashboardStats {
  monthlyRecurringRevenue?: number;
  mrr?: number;
  activeCustomers?: number;
  active_customers?: number;
  churnRate?: number;
  churn_rate?: number;
  recentInvoices?: Invoice[];
  recent_invoices?: Invoice[];
  invoices?: Invoice[];
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stats', { signal });
      if (!response.ok) {
        throw new Error(`Failed to load stats (${response.status} ${response.statusText})`);
      }
      const data: DashboardStats = await response.json();
      setStats(data);
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

    return () => {
      controller.abort();
    };
  }, [fetchStats]);

  const formatCurrency = (val?: number): string => {
    if (val === undefined || isNaN(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const formatNumber = (val?: number): string => {
    if (val === undefined || isNaN(val)) return '0';
    return new Intl.NumberFormat('en-US').format(val);
  };

  const formatPercent = (val?: number): string => {
    if (val === undefined || isNaN(val)) return '0.0%';
    const normalized = val > 1 ? val : val * 100;
    return `${normalized.toFixed(1)}%`;
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'N/A';
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed);
  };

  const getCustomerName = (customer: Invoice['customer']): string => {
    if (typeof customer === 'string') return customer;
    if (customer && typeof customer === 'object') return customer.name || 'Unnamed Customer';
    return 'Unknown';
  };

  const getCustomerEmail = (customer: Invoice['customer']): string | undefined => {
    if (typeof customer === 'object' && customer?.email) return customer.email;
    return undefined;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full" />
            Paid
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <span className="w-1.5 h-1.5 mr-1.5 bg-amber-500 rounded-full" />
            Pending
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
            <span className="w-1.5 h-1.5 mr-1.5 bg-rose-500 rounded-full" />
            Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
            <span className="w-1.5 h-1.5 mr-1.5 bg-gray-400 rounded-full" />
            {status}
          </span>
        );
    }
  };

  const mrrValue = stats?.monthlyRecurringRevenue ?? stats?.mrr;
  const activeCustomersValue = stats?.activeCustomers ?? stats?.active_customers;
  const churnRateValue = stats?.churnRate ?? stats?.churn_rate;
  const rawInvoices = stats?.recentInvoices ?? stats?.recent_invoices ?? stats?.invoices ?? [];
  const invoices = rawInvoices.slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg">
                L
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ledgerly</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">Admin financial overview and recent billing activity.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchStats()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition shadow-sm"
              title="Refresh dashboard data"
            >
              <svg
                className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </header>

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-red-900">Error loading dashboard</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fetchStats()}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-red-800 bg-red-100 hover:bg-red-200 border border-red-300 rounded-md transition shadow-xs"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && !stats && (
          <div className="space-y-8 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs h-36 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="h-4 w-28 bg-slate-200 rounded" />
                    <div className="h-10 w-10 bg-slate-100 rounded-xl" />
                  </div>
                  <div>
                    <div className="h-8 w-36 bg-slate-200 rounded mb-2" />
                    <div className="h-3 w-20 bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="h-5 w-40 bg-slate-200 rounded" />
              </div>
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((row) => (
                  <div key={row} className="flex justify-between items-center gap-4">
                    <div className="h-4 w-32 bg-slate-200 rounded" />
                    <div className="h-4 w-20 bg-slate-200 rounded" />
                    <div className="h-5 w-16 bg-slate-100 rounded-full" />
                    <div className="h-4 w-24 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loaded Content */}
        {(!loading || stats) && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Monthly Recurring Revenue */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Monthly Recurring Revenue</span>
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {formatCurrency(mrrValue)}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Total recurring monthly subscription volume</p>
                </div>
              </div>

              {/* Active Customers */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Active Customers</span>
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {formatNumber(activeCustomersValue)}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Currently active accounts across all plans</p>
                </div>
              </div>

              {/* Churn Rate */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Churn Rate</span>
                  <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                      />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {formatPercent(churnRateValue)}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Customer cancellations over current 30 days</p>
                </div>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Recent Invoices</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Showing the 10 most recent invoices</p>
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  {invoices.length} {invoices.length === 1 ? 'entry' : 'entries'} listed
                </div>
              </div>

              {invoices.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="mt-3 text-sm font-medium text-slate-900">No invoices found</p>
                  <p className="text-xs text-slate-500 mt-1">There are no recent invoices to display at this time.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50/75 text-xs uppercase font-semibold text-slate-500 tracking-wider">
                      <tr>
                        <th scope="col" className="px-6 py-3.5">Customer</th>
                        <th scope="col" className="px-6 py-3.5">Amount</th>
                        <th scope="col" className="px-6 py-3.5">Status</th>
                        <th scope="col" className="px-6 py-3.5">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {invoices.map((inv, index) => {
                        const dueDate = inv.dueDate || inv.due_date;
                        const key = inv.id ?? `${getCustomerName(inv.customer)}-${index}`;
                        const email = getCustomerEmail(inv.customer);

                        return (
                          <tr key={key} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-slate-900">{getCustomerName(inv.customer)}</div>
                              {email && <div className="text-xs text-slate-400">{email}</div>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                              {formatCurrency(inv.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(inv.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-sm">
                              {formatDate(dueDate)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
