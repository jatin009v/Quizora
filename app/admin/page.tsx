'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MagneticButton } from '@/components/ui/MagneticButton';
import {
  FileText,
  Users,
  HelpCircle,
  Shield,
  Plus,
  BarChart3,
  Award,
  ArrowRight,
  UserPlus,
  Upload,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useBfcacheProtection } from '@/components/useBfcacheProtection';

export default function AdminDashboardPage() {
  const { handleLogout } = useBfcacheProtection();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPapers: 0,
    totalQuestions: 0,
    totalAttempts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [usersRes, papersRes, questionsRes] = await Promise.all([
          fetch('/api/admin/users').then((r) => r.json()).catch(() => ({ users: [] })),
          fetch('/api/admin/papers').then((r) => r.json()).catch(() => ({ papers: [] })),
          fetch('/api/admin/questions').then((r) => r.json()).catch(() => ({ questions: [] })),
        ]);

        setStats({
          totalUsers: usersRes.users?.length || 0,
          totalPapers: papersRes.papers?.length || 0,
          totalQuestions: questionsRes.questions?.length || 0,
          totalAttempts: 12, // Demo baseline metric
        });
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b-4 border-brand-black">
          <div>
            <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
              ADMINISTRATIVE HUB
            </span>
            <h1 className="font-display font-black text-4xl md:text-6xl uppercase text-brand-black mt-2">
              Examination Control Dashboard
            </h1>
            <p className="text-slate-600 font-medium text-lg mt-1">
              Manage questions, build exam papers, manage student accounts, and monitor results.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/proctor">
              <MagneticButton variant="secondary" size="md">
                <Shield className="w-4 h-4 mr-2" /> Proctor Dashboard
              </MagneticButton>
            </Link>
            <MagneticButton variant="outline" size="md" onClick={handleLogout}>
              Sign Out
            </MagneticButton>
          </div>
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">Registered Users</span>
                <Users className="w-5 h-5 text-burnt-orange" />
              </div>
              <p className="font-display font-black text-4xl text-brand-black mt-2">
                {loading ? '...' : stats.totalUsers}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-4 font-medium">Students, Proctors & Admins</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">Exam Papers</span>
                <FileText className="w-5 h-5 text-vibrant-pink" />
              </div>
              <p className="font-display font-black text-4xl text-brand-black mt-2">
                {loading ? '...' : stats.totalPapers}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-4 font-medium">Draft & Published Papers</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">Proctor Integrity</span>
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="font-display font-black text-4xl text-emerald-600 mt-2">ACTIVE</p>
            </div>
            <p className="text-xs text-slate-500 mt-4 font-medium">3-Violation Auto Lock Protection</p>
          </div>
        </div>

        {/* QUICK NAVIGATION MODULES */}
        <div className="space-y-4">
          <h2 className="font-display font-black text-2xl uppercase tracking-tight text-brand-black">
            Platform Operations & Management
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* MODULE 1: PAPER BUILDER */}
            <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between group hover:border-burnt-orange transition-colors">
              <div>
                <div className="w-12 h-12 bg-burnt-orange text-white rounded-xl flex items-center justify-center border-2 border-brand-black shadow-editorial mb-4">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="font-display font-black text-2xl uppercase text-brand-black">Paper Builder & Questions</h3>
                <p className="text-sm text-slate-600 mt-2">
                  Build exam papers, create paper-centric questions directly inside papers, configure schedules, and generate access codes.
                </p>
              </div>

              <div className="mt-6 space-y-2 pt-4 border-t-2 border-slate-100">
                <Link
                  href="/admin/papers/new"
                  className="flex items-center justify-between text-sm font-bold text-burnt-orange hover:underline"
                >
                  <span>Build New Exam Paper</span>
                  <Plus className="w-4 h-4" />
                </Link>
                <Link
                  href="/admin/papers"
                  className="flex items-center justify-between text-sm font-bold text-slate-700 hover:text-brand-black"
                >
                  <span>View All Papers & Results</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* MODULE 2: USER MANAGEMENT */}
            <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between group hover:border-vibrant-pink transition-colors">
              <div>
                <div className="w-12 h-12 bg-vibrant-pink text-white rounded-xl flex items-center justify-center border-2 border-brand-black shadow-editorial mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="font-display font-black text-2xl uppercase text-brand-black">User Directory</h3>
                <p className="text-sm text-slate-600 mt-2">
                  Manage student accounts, create single credentials, import bulk Excel rosters, or disable user access.
                </p>
              </div>

              <div className="mt-6 space-y-2 pt-4 border-t-2 border-slate-100">
                <Link
                  href="/admin/users/new"
                  className="flex items-center justify-between text-sm font-bold text-vibrant-pink hover:underline"
                >
                  <span>Create Single Account</span>
                  <UserPlus className="w-4 h-4" />
                </Link>
                <Link
                  href="/admin/users/import"
                  className="flex items-center justify-between text-sm font-bold text-slate-700 hover:text-brand-black"
                >
                  <span>Bulk Excel Import</span>
                  <Upload className="w-4 h-4" />
                </Link>
                <Link
                  href="/admin/users"
                  className="flex items-center justify-between text-sm font-bold text-slate-700 hover:text-brand-black"
                >
                  <span>View Student Directory</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* PROCTOR HUB SHORTCUT BANNER */}
        <div className="bg-brand-black text-white p-8 rounded-3xl border-4 border-brand-black shadow-editorial flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-burnt-orange text-white rounded font-mono text-xs font-bold uppercase">
              <Shield className="w-3.5 h-3.5" /> Real-time Proctoring Active
            </div>
            <h3 className="font-display font-black text-3xl uppercase text-warm-beige">
              Monitor Live Examination Candidates
            </h3>
            <p className="text-slate-300 font-medium max-w-2xl text-sm">
              Track tab switches, window blur events, and fullscreen exits in real time. Manually lock candidates or reopen locked attempts with full state preservation.
            </p>
          </div>

          <Link href="/proctor">
            <MagneticButton variant="primary" size="lg">
              Launch Proctor Hub <ArrowRight className="w-5 h-5 ml-2" />
            </MagneticButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
