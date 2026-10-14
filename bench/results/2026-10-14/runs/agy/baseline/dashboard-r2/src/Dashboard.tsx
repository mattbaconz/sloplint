import React, { useState, useEffect } from 'react';

export interface Invoice {
  id?: string | number;
  customer?: string | { name?: string; email?: string };
  customerName?: string;
  customer_name?: string;
  amount: number | string;
  status: string;
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
  stats?: Partial<StatsResponse>;
  data?: Partial<StatsResponse>;
}

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/stats', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch stats (HTTP ${response.status})`);
        }

        const json: StatsResponse = await response.json();
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          setError(err instanceof Error ? err.message : 'An error occurred while loading dashboard statistics.');
          setLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [retryCount]);

  // Extract nested stats/data if present
  const statsSource = data?.data || data?.stats || data || {};

  const mrr = statsSource.monthlyRecurringRevenue ?? statsSource.monthly_recurring_revenue ?? statsSource.mrr;
  const activeCustomers = statsSource.activeCustomers ?? statsSource.active_customers ?? statsSource.customers;
  const churnRate = statsSource.churnRate ?? statsSource.churn_rate;

  const rawInvoices =
    statsSource.invoices ||
    statsSource.recentInvoices ||
    statsSource.recent_invoices ||
    data?.invoices ||
    data?.recentInvoices ||
    [];

  const recentInvoices: Invoice[] = Array.isArray(rawInvoices) ? rawInvoices.slice(0, 10) : [];

  const formatCurrency = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null) return '$0';
    if (typeof val === 'number') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: val % 1 === 0 ? 0 : 2,
      }).format(val);
    }
    const str = String(val).trim();
    if (str.startsWith('$')) return str;
    const num = parseFloat(str.replace(/,/g, ''));
    if (!isNaN(num)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: num % 1 === 0 ? 0 : 2,
      }).format(num);
    }
    return str;
  };

  const formatCustomers = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null) return '0';
    if (typeof val === 'number') {
      return val.toLocaleString('en-US');
    }
    return String(val);
  };

  const formatPercentage = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null) return '0%';
    if (typeof val === 'number') {
      return `${val}%`;
    }
    const str = String(val).trim();
    return str.endsWith('%') ? str : `${str}%`;
  };

  const getCustomerName = (invoice: Invoice): string => {
    if (typeof invoice.customer === 'string' && invoice.customer.trim()) {
      return invoice.customer;
    }
    if (invoice.customer && typeof invoice.customer === 'object') {
      if (invoice.customer.name) return invoice.customer.name;
      if (invoice.customer.email) return invoice.customer.email;
    }
    if (invoice.customerName) return invoice.customerName;
    if (invoice.customer_name) return invoice.customer_name;
    return 'Unknown Customer';
  };

  const getDueDate = (invoice: Invoice): string => {
    const rawDate = invoice.dueDate ?? invoice.due_date ?? invoice.date;
    if (!rawDate) return 'N/A';
    return String(rawDate);
  };

  const renderStatusBadge = (status: string) => {
    const normalized = (status || '').toLowerCase().trim();
    let badgeClasses = 'bg-gray-100 text-gray-800 border-gray-200';

    if (normalized === 'paid' || normalized === 'complete' || normalized === 'completed') {
      badgeClasses = 'bg-green-100 text-green-800 border-green-200';
    } else if (normalized === 'pending' || normalized === 'processing') {
      badgeClasses = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    } else if (normalized === 'overdue' || normalized === 'unpaid' || normalized === 'failed') {
      badgeClasses = 'bg-red-100 text-red-800 border-red-200';
    } else if (normalized === 'draft') {
      badgeClasses = 'bg-blue-100 text-blue-800 border-blue-200';
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${badgeClasses}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" role="status" aria-label="Loading dashboard">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium text-base">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl shadow-sm p-6 text-center" role="alert">
          <div className="w-12 h-12 mx-auto bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => setRetryCount((prev) => prev + 1)}
            className="w-full inline-flex justify-center items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Ledgerly Admin Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Overview of revenue, customer growth, and recent billing activity.
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* MRR Card */}
          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 truncate">Monthly Recurring Revenue</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{formatCurrency(mrr)}</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Active Customers Card */}
          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 truncate">Active Customers</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{formatCustomers(activeCustomers)}</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>

          {/* Churn Rate Card */}
          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 p-6 flex items-center justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <p className="text-sm font-medium text-gray-500 truncate">Churn Rate</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{formatPercentage(churnRate)}</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Invoices</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Latest billing transactions and payment status
              </p>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              Showing {recentInvoices.length} {recentInvoices.length === 1 ? 'invoice' : 'invoices'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentInvoices.length > 0 ? (
                  recentInvoices.map((invoice, index) => (
                    <tr key={invoice.id ?? index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getCustomerName(invoice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {renderStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getDueDate(invoice)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                      No recent invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
