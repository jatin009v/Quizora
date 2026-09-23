'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  Users,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Clock,
  BookOpen,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { useBfcacheProtection } from '@/components/useBfcacheProtection';

export default function ProctorDashboardPage() {
  const { handleLogout } = useBfcacheProtection();
  const [metrics, setMetrics] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setRefreshing(true);
      const [summaryRes, attemptsRes] = await Promise.all([
        fetch('/api/proctor/dashboard', { signal: controller.signal }),
        fetch(`/api/proctor/attempts?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal,
        }),
      ]);

      if (controller.signal.aborted) return;

      const summaryJson = await summaryRes.json();
      const attemptsJson = await attemptsRes.json();

      if (controller.signal.aborted) return;

      if (summaryRes.ok && summaryJson.success) {
        setMetrics(summaryJson.data);
      }
      if (attemptsRes.ok && attemptsJson.success) {
        setAttempts(attemptsJson.data);
      } else {
        setError(attemptsJson.error || 'Failed to load student attempts.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError('Network error fetching proctor monitoring data.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 5000);
    return () => {
      clearInterval(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-brand-black flex items-center justify-center p-6 font-mono font-bold text-slate-600">
        Loading Proctor Control Center...
      </div>
    );
  }

  const summary = metrics?.summary || {
    totalAttempts: 0,
    activeCount: 0,
    warningCount: 0,
    lockedCount: 0,
    submittedCount: 0,
  };

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-4 md:p-8 noise-bg space-y-8">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-brand-black pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
              PROCTOR CONTROL CENTER
            </span>
            {refreshing && (
              <span className="text-xs font-mono font-bold text-burnt-orange flex items-center gap-1 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Live Syncing
              </span>
            )}
          </div>
          <h1 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black mt-1">
            Exam Integrity Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="py-2.5 px-4 bg-white border-2 border-brand-black rounded-xl font-mono text-xs font-bold uppercase shadow-editorial hover:bg-warm-beige flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-brand-black" /> Manual Refresh
          </button>
          <button
            onClick={handleLogout}
            className="py-2.5 px-4 bg-white border-2 border-brand-black rounded-xl font-mono text-xs font-bold uppercase shadow-editorial hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* METRICS METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial space-y-2">
          <div className="flex items-center justify-between text-slate-600">
            <span className="font-mono text-xs font-bold uppercase">Active Students</span>
            <Users className="w-5 h-5 text-deep-blue" />
          </div>
          <div className="font-display font-black text-3xl md:text-4xl text-brand-black">
            {summary.activeCount}
          </div>
          <p className="text-xs font-mono text-slate-500">Taking exam right now</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial space-y-2">
          <div className="flex items-center justify-between text-amber-700">
            <span className="font-mono text-xs font-bold uppercase">Warnings</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="font-display font-black text-3xl md:text-4xl text-amber-600">
            {summary.warningCount}
          </div>
          <p className="text-xs font-mono text-slate-500">1 or 2 integrity events</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial space-y-2">
          <div className="flex items-center justify-between text-burnt-orange">
            <span className="font-mono text-xs font-bold uppercase">Locked Attempts</span>
            <Lock className="w-5 h-5 text-burnt-orange" />
          </div>
          <div className="font-display font-black text-3xl md:text-4xl text-burnt-orange">
            {summary.lockedCount}
          </div>
          <p className="text-xs font-mono text-slate-500">Requires Proctor reopen</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial space-y-2">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="font-mono text-xs font-bold uppercase">Submitted</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="font-display font-black text-3xl md:text-4xl text-emerald-600">
            {summary.submittedCount}
          </div>
          <p className="text-xs font-mono text-slate-500">Exams completed</p>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial-lg space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* SEARCH INPUT */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, username, or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-warm-beige border-2 border-brand-black rounded-xl font-mono text-xs font-bold text-brand-black focus:outline-none focus:ring-2 focus:ring-burnt-orange"
            />
          </div>

          {/* STATUS FILTER TABS */}
          <div className="flex flex-wrap items-center gap-1.5 bg-warm-beige p-1.5 rounded-xl border-2 border-brand-black">
            {['ALL', 'NORMAL', 'WARNING', 'LOCKED', 'SUBMITTED'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold uppercase transition-all ${
                  statusFilter === status
                    ? 'bg-brand-black text-white shadow-editorial'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* STUDENT MONITORING TABLE */}
        <div className="overflow-x-auto border-2 border-brand-black rounded-xl">
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-brand-black text-warm-beige font-mono text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4 border-b-2 border-brand-black">Student Details</th>
                <th className="p-4 border-b-2 border-brand-black">Quiz Title</th>
                <th className="p-4 border-b-2 border-brand-black">Status</th>
                <th className="p-4 border-b-2 border-brand-black">Current Q</th>
                <th className="p-4 border-b-2 border-brand-black">Violations</th>
                <th className="p-4 border-b-2 border-brand-black">Started At</th>
                <th className="p-4 border-b-2 border-brand-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-brand-black/20 bg-white">
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center font-mono text-xs text-slate-500 font-bold">
                    No active student attempts match the selected filter.
                  </td>
                </tr>
              ) : (
                attempts.map((attempt) => (
                  <tr key={attempt.attemptId} className="hover:bg-warm-beige/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-brand-black">{attempt.studentName}</div>
                      <div className="font-mono text-xs text-slate-500">
                        @{attempt.username} • Year: {attempt.year} ({attempt.course})
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-800">{attempt.paperTitle}</td>
                    <td className="p-4">
                      {attempt.displayStatus === 'NORMAL' && (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-400 font-mono text-xs font-bold">
                          NORMAL
                        </span>
                      )}
                      {attempt.displayStatus === 'WARNING' && (
                        <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-400 font-mono text-xs font-bold flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3.5 h-3.5" /> WARNING
                        </span>
                      )}
                      {attempt.displayStatus === 'LOCKED' && (
                        <span className="px-2.5 py-1 rounded-md bg-burnt-orange text-white border border-brand-black font-mono text-xs font-bold flex items-center gap-1 w-fit shadow-editorial-pink">
                          <Lock className="w-3.5 h-3.5" /> LOCKED
                        </span>
                      )}
                      {attempt.displayStatus === 'SUBMITTED' && (
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-300 font-mono text-xs font-bold">
                          SUBMITTED
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-800">
                      Q{attempt.lastQuestionIndex + 1}
                    </td>
                    <td className="p-4">
                      <span className={`font-mono font-bold ${attempt.tabSwitchCount >= 3 ? 'text-burnt-orange' : attempt.tabSwitchCount > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                        {attempt.tabSwitchCount} Events
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-500">
                      {attempt.startedAt ? new Date(attempt.startedAt).toLocaleTimeString() : 'N/A'}
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/proctor/attempts/${attempt.attemptId}`}
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-brand-black text-white rounded-lg font-mono text-xs font-bold uppercase shadow-editorial hover:bg-burnt-orange transition-colors"
                      >
                        Timeline <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECENT INTEGRITY EVENTS FEED */}
      {metrics?.recentEvents && metrics.recentEvents.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial space-y-4">
          <h3 className="font-display font-black text-xl uppercase text-brand-black flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-burnt-orange" /> Real-Time Integrity Event Feed
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {metrics.recentEvents.map((ev: any) => (
              <div
                key={ev.id}
                className="bg-warm-beige p-3.5 rounded-xl border-2 border-brand-black font-mono text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-burnt-orange uppercase">{ev.eventType}</span>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(ev.eventTime).toLocaleTimeString()}
                  </span>
                </div>
                <div className="font-bold text-brand-black truncate">{ev.studentName} (@{ev.username})</div>
                <div className="text-slate-600 text-[11px]">
                  Question {ev.questionIndex + 1} • {ev.paperTitle}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
