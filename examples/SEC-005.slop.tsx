'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminDashboard } from './dashboard';

export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);
  return <AdminDashboard />;
}
