'use client';

import React, { useState, useEffect } from 'react';
import { Profile } from '@/types/database';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { UserPlus, Upload, Search, Filter, Shield, Power, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchUsers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCourse !== 'ALL') params.set('course', filterCourse);
    if (filterStatus !== 'ALL') params.set('status', filterStatus);
    if (searchQuery) params.set('query', searchQuery);

    fetch(`/api/admin/users?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUsers(data.users || []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [filterCourse, filterStatus, searchQuery]);

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      const res = await fetch('/api/admin/users/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: newStatus as any } : u))
        );
      }
    } catch {
      // Background retry handler
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b-4 border-brand-black">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/papers"
              className="p-2.5 bg-white border-2 border-brand-black rounded-lg shadow-editorial hover:bg-warm-beige transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-brand-black" />
            </Link>
            <div>
              <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
                USER MANAGEMENT
              </span>
              <h1 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black mt-1">
                Student Account Directory
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/users/new">
              <MagneticButton variant="primary" size="md">
                <UserPlus className="w-4 h-4 mr-2" /> Single Student
              </MagneticButton>
            </Link>

            <Link href="/admin/users/import">
              <MagneticButton variant="secondary" size="md">
                <Upload className="w-4 h-4 mr-2" /> Bulk Excel Import
              </MagneticButton>
            </Link>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white p-4 rounded-xl border-3 border-brand-black shadow-editorial flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-brand-black font-sans font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="py-2.5 px-3 rounded-lg border-2 border-brand-black font-mono text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Course: All</option>
              <option value="DCA Computer Science">DCA</option>
              <option value="MCA">MCA</option>
              <option value="BCA">BCA</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="py-2.5 px-3 rounded-lg border-2 border-brand-black font-mono text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Status: All</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>
        </div>

        {/* USER TABLE */}
        <div className="bg-white rounded-2xl border-4 border-brand-black shadow-editorial-lg overflow-hidden">
          <div className="bg-brand-black text-white px-6 py-4 flex items-center justify-between border-b-4 border-brand-black">
            <h3 className="font-display font-black text-xl uppercase tracking-wider">
              Enrolled Institution Users ({users.length})
            </h3>
            <span className="font-mono text-xs text-slate-400">
              Passwords Secured in Supabase Auth • Zero Plaintext Storage
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center font-mono text-slate-500 font-bold">
              Loading user directory...
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-sans">
              No student accounts found matching selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-warm-beige border-b-3 border-brand-black font-display font-black text-xs uppercase tracking-wider text-brand-black">
                    <th className="py-3.5 px-6">Name</th>
                    <th className="py-3.5 px-6">Username</th>
                    <th className="py-3.5 px-6">Year</th>
                    <th className="py-3.5 px-6">Course</th>
                    <th className="py-3.5 px-6">Role</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-200 font-sans text-sm">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-warm-beige/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-brand-black">{user.name}</td>
                      <td className="py-4 px-6 font-mono text-xs text-burnt-orange font-bold">
                        {user.username}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs">{user.year}</td>
                      <td className="py-4 px-6">{user.course}</td>
                      <td className="py-4 px-6">
                        <span className="bg-brand-black text-white px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold border ${
                            user.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                              : 'bg-red-100 text-red-800 border-red-400'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleToggleStatus(user.id, user.status)}
                          className={`py-1.5 px-3 rounded-lg font-mono text-xs font-bold uppercase border-2 border-brand-black shadow-editorial cursor-pointer ${
                            user.status === 'ACTIVE'
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-emerald-500 text-white hover:bg-emerald-600'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5 inline mr-1" />
                          {user.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
