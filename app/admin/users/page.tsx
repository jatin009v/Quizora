'use client';

import React, { useState, useEffect } from 'react';
import { Profile } from '@/types/database';
import { MagneticButton } from '@/components/ui/MagneticButton';
import {
  UserPlus,
  Upload,
  Search,
  Power,
  ArrowLeft,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<'PARTICIPANTS' | 'ADMIN_PROCTOR'>('PARTICIPANTS');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Single Delete Modal
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [singleDeleteError, setSingleDeleteError] = useState<string | null>(null);

  // Bulk Delete Modal
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkConfirmInput, setBulkConfirmInput] = useState('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState<string | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('page', page.toString());
    params.set('limit', '25');

    if (filterCourse !== 'ALL') params.set('course', filterCourse);
    if (filterStatus !== 'ALL') params.set('status', filterStatus);
    if (searchQuery.trim()) params.set('query', searchQuery.trim());

    fetch(`/api/admin/users?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUsers(data.users || []);
          setTotalPages(data.totalPages || 1);
          setTotalCount(data.total || 0);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
  }, [activeTab, filterCourse, filterStatus, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [activeTab, filterCourse, filterStatus, searchQuery, page]);

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
      // Handled silently
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    setSingleDeleteError(null);

    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setDeletingUser(null);
        fetchUsers();
      } else {
        setSingleDeleteError(data.error || 'Failed to delete participant account.');
      }
    } catch {
      setSingleDeleteError('Network error trying to delete account.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkConfirmInput !== 'DELETE PARTICIPANTS') {
      setBulkDeleteError('Please type "DELETE PARTICIPANTS" exactly to confirm.');
      return;
    }

    setIsBulkDeleting(true);
    setBulkDeleteError(null);

    try {
      const res = await fetch('/api/admin/users/delete-participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: bulkConfirmInput }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowBulkDeleteModal(false);
        setBulkConfirmInput('');
        setBulkSuccessMessage(data.message || `Deleted ${data.deletedCount} participants.`);
        fetchUsers();
        setTimeout(() => setBulkSuccessMessage(null), 6000);
      } else {
        setBulkDeleteError(data.error || 'Failed to execute bulk deletion.');
      }
    } catch {
      setBulkDeleteError('Network error executing bulk deletion.');
    } finally {
      setIsBulkDeleting(false);
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
                USER DIRECTORY & CLEANUP
              </span>
              <h1 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black mt-1">
                Account Management
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

        {/* NOTIFICATION FEEDBACK */}
        {bulkSuccessMessage && (
          <div className="p-4 rounded-xl bg-emerald-100 border-3 border-brand-black text-emerald-900 font-mono text-xs font-bold flex items-center gap-3 shadow-editorial">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <span>{bulkSuccessMessage}</span>
          </div>
        )}

        {/* DIRECTORY SECTIONS / TABS */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-3 border-brand-black pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('PARTICIPANTS')}
              className={`px-5 py-2.5 rounded-xl font-display font-black text-sm uppercase tracking-wider border-3 border-brand-black transition-all shadow-editorial cursor-pointer ${
                activeTab === 'PARTICIPANTS'
                  ? 'bg-burnt-orange text-white'
                  : 'bg-white text-brand-black hover:bg-warm-beige'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" /> PARTICIPANTS ({activeTab === 'PARTICIPANTS' ? totalCount : 'Batch'})
            </button>

            <button
              onClick={() => setActiveTab('ADMIN_PROCTOR')}
              className={`px-5 py-2.5 rounded-xl font-display font-black text-sm uppercase tracking-wider border-3 border-brand-black transition-all shadow-editorial cursor-pointer ${
                activeTab === 'ADMIN_PROCTOR'
                  ? 'bg-brand-black text-white'
                  : 'bg-white text-brand-black hover:bg-warm-beige'
              }`}
            >
              <ShieldCheck className="w-4 h-4 inline mr-2 text-burnt-orange-light" /> ADMIN & PROCTOR
            </button>
          </div>

          {activeTab === 'PARTICIPANTS' && (
            <button
              onClick={() => {
                setBulkConfirmInput('');
                setBulkDeleteError(null);
                setShowBulkDeleteModal(true);
              }}
              className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold uppercase rounded-xl border-2 border-brand-black shadow-editorial flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Delete All Participants
            </button>
          )}
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
              {activeTab === 'PARTICIPANTS' ? 'Test & Batch Candidates' : 'Protected Faculty & Administration Accounts'} ({totalCount})
            </h3>
            <span className="font-mono text-xs text-slate-400">
              Passwords Secured in Supabase Auth • Zero Plaintext Storage
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center font-mono text-slate-500 font-bold">
              Loading accounts...
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-sans">
              No accounts found matching selected filters.
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
                  {users.map((user) => {
                    const isDemoUser = user.username.toLowerCase() === 'csjma22000022674';
                    const isProtected = user.role === 'ADMIN' || user.role === 'PROCTOR' || isDemoUser;

                    return (
                      <tr key={user.id} className="hover:bg-warm-beige/50 transition-colors">
                        <td className="py-4 px-6 font-bold text-brand-black flex items-center gap-2">
                          {user.name}
                          {isProtected && (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                              Protected
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-burnt-orange font-bold">
                          {user.username}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs">{user.year || 'N/A'}</td>
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
                        <td className="py-4 px-6 text-right space-x-2">
                          <button
                            onClick={() => handleToggleStatus(user.id, user.status)}
                            className={`py-1.5 px-3 rounded-lg font-mono text-xs font-bold uppercase border-2 border-brand-black shadow-editorial cursor-pointer ${
                              user.status === 'ACTIVE'
                                ? 'bg-amber-400 text-brand-black hover:bg-amber-500'
                                : 'bg-emerald-500 text-white hover:bg-emerald-600'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5 inline mr-1" />
                            {user.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                          </button>

                          {!isProtected && (
                            <button
                              onClick={() => {
                                setDeletingUser(user);
                                setSingleDeleteError(null);
                              }}
                              className="py-1.5 px-3 bg-red-600 text-white hover:bg-red-700 rounded-lg font-mono text-xs font-bold uppercase border-2 border-brand-black shadow-editorial cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION FOOTER */}
          <div className="bg-warm-beige p-4 border-t-3 border-brand-black flex flex-wrap items-center justify-between gap-4 font-mono text-xs font-bold">
            <span className="text-slate-600">
              Showing page <strong className="text-brand-black">{page}</strong> of{' '}
              <strong className="text-brand-black">{totalPages}</strong> ({totalCount} total accounts)
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white border-2 border-brand-black rounded-lg shadow-editorial disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 inline mr-1" /> Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-white border-2 border-brand-black rounded-lg shadow-editorial disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SINGLE PARTICIPANT DELETE MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 bg-brand-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-2xl border-4 border-brand-black shadow-editorial-lg p-6 space-y-6">
            <div className="flex items-center gap-3 border-b-3 border-brand-black pb-4 text-red-600">
              <AlertTriangle className="w-7 h-7" />
              <h3 className="font-display font-black text-xl uppercase">Delete Participant?</h3>
            </div>

            {singleDeleteError && (
              <div className="p-3 bg-red-100 border-2 border-red-500 text-red-900 font-mono text-xs font-bold rounded-lg">
                {singleDeleteError}
              </div>
            )}

            <p className="text-sm font-sans text-slate-700 leading-relaxed">
              This will permanently remove participant <strong className="text-brand-black">{deletingUser.name}</strong> (
              <span className="font-mono text-burnt-orange font-bold">@{deletingUser.username}</span>) and associated exam attempts, answers, and proctor events.
            </p>

            <div className="bg-warm-beige p-3 rounded-xl border-2 border-brand-black font-mono text-xs text-slate-600">
              ⚠️ This action cannot be undone.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeletingUser(null)}
                className="py-2 px-4 rounded-xl border-2 border-brand-black font-mono text-xs font-bold uppercase hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleConfirmSingleDelete}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold uppercase rounded-xl border-2 border-brand-black shadow-editorial cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Participant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK PARTICIPANTS DELETE MODAL */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-brand-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleConfirmBulkDelete}
            className="bg-white max-w-lg w-full rounded-2xl border-4 border-brand-black shadow-editorial-lg p-6 space-y-6"
          >
            <div className="flex items-center gap-3 border-b-3 border-brand-black pb-4 text-red-600">
              <ShieldAlert className="w-8 h-8" />
              <div>
                <h3 className="font-display font-black text-xl uppercase">DELETE ALL TEST PARTICIPANTS</h3>
                <p className="font-mono text-xs text-slate-500">Batch Cleanup Operation</p>
              </div>
            </div>

            {bulkDeleteError && (
              <div className="p-3 bg-red-100 border-2 border-red-500 text-red-900 font-mono text-xs font-bold rounded-lg">
                {bulkDeleteError}
              </div>
            )}

            <div className="space-y-3 font-sans text-sm text-slate-700">
              <p>
                This will permanently remove all normal test candidate accounts and their exam attempts, answers, and proctor events.
              </p>

              <div className="bg-emerald-50 border-2 border-emerald-400 p-3 rounded-xl font-mono text-xs text-emerald-900">
                ✅ <strong>Protected Accounts Kept Safe:</strong> Pushpa Mamoria, Himanshu Shukla, Jatin Gupta, Dr. Shekhar Verma, Akhilesh Singh, Ms. Richa Dixit Pandey, Durgesh Gupta, all Proctors, and permanent <strong>Demo User 1</strong>.
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-mono text-xs font-bold uppercase text-slate-700">
                Type <strong className="text-red-600">DELETE PARTICIPANTS</strong> to confirm:
              </label>
              <input
                type="text"
                value={bulkConfirmInput}
                onChange={(e) => setBulkConfirmInput(e.target.value)}
                placeholder="DELETE PARTICIPANTS"
                className="w-full p-3 rounded-xl border-2 border-brand-black font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
                className="py-2.5 px-4 rounded-xl border-2 border-brand-black font-mono text-xs font-bold uppercase hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBulkDeleting || bulkConfirmInput !== 'DELETE PARTICIPANTS'}
                className="py-2.5 px-5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono text-xs font-bold uppercase rounded-xl border-2 border-brand-black shadow-editorial cursor-pointer"
              >
                {isBulkDeleting ? 'Deleting All...' : 'DELETE ALL PARTICIPANTS'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
