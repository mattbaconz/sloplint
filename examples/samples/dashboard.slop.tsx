'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner, ChartIcon, BoltIcon, ShieldIcon } from '@/components/icons';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ revenue: 0, customers: 0, churn: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/login');
  }, [router]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/stats');
      const body = await res.json();
      setStats(body.stats);
      setNotice(body.notice);
    } catch (err) {
      console.error(err);
      setError('Oops! Something went wrong.');
    }
    setLoading(false);
  }

  return (
    <main className="p-8">
      <section className="rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-10 text-white">
        <h1 className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-5xl font-bold text-transparent">
          Supercharge your revenue
        </h1>
        <p>Seamlessly unlock your full potential with next-gen analytics.</p>
      </section>

      <div className="mt-8 grid grid-cols-3 gap-6">
        <div className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100"><ChartIcon /></div><h3>Insights</h3><p>Understand your data.</p></div>
        <div className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100"><BoltIcon /></div><h3>Speed</h3><p>Move faster.</p></div>
        <div className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100"><ShieldIcon /></div><h3>Security</h3><p>Stay protected.</p></div>
      </div>

      <dl className="mt-8 grid grid-cols-3">
        <div><dt>Revenue</dt><dd className="stat text-3xl">${stats.revenue.toLocaleString()}</dd></div>
        <div><dt>Customers</dt><dd className="stat text-3xl">{stats.customers.toLocaleString()}</dd></div>
        <div><dt>Churn</dt><dd className="stat text-3xl">{stats.churn.toFixed(1)}%</dd></div>
      </dl>

      <table className="mt-8 w-full tabular-nums">
        <thead><tr><th>Invoice</th><th>Customer</th><th>Plan</th><th>Seats</th><th>Amount</th><th>Due</th></tr></thead>
      </table>

      <p className="mt-8">Signed in as John Doe, Acme Inc.</p>
      <div className="notice" dangerouslySetInnerHTML={{ __html: `<strong>Update:</strong> ${notice}` }} />
      <a href="/reports">Learn more</a>
      {error && <p role="alert">{error}</p>}
      <button onClick={refresh} className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-all duration-300 hover:scale-105">
        {loading ? <Spinner className="h-4 w-4 animate-spin" /> : 'Submit'}
      </button>
    </main>
  );
}
