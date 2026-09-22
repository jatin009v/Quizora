'use client';

import React, { useState, useEffect } from 'react';
import { PaperLeaderboardResult } from '@/lib/exam/leaderboardService';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { Award, Trophy, Users, Clock, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function AdminResultsPage({ params }: { params: { paperId: string } }) {
  const [data, setData] = useState<PaperLeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchResults = () => {
    setLoading(true);
    fetch(`/api/admin/papers/${params.paperId}/results`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchResults();
  }, [params.paperId]);

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
                ADMIN LEADERBOARD ENGINE
              </span>
              <h1 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black mt-1">
                {data?.paperTitle || 'DCA Exam Leaderboard'}
              </h1>
            </div>
          </div>

          <button
            onClick={fetchResults}
            className="px-4 py-2.5 bg-white border-2 border-brand-black rounded-lg font-mono text-xs font-bold uppercase shadow-editorial hover:bg-warm-beige flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Leaderboard
          </button>
        </div>

        {/* ANALYTICS SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border-3 border-brand-black shadow-editorial">
            <p className="font-mono text-xs font-bold text-slate-500 uppercase">Total Participants</p>
            <p className="font-display font-black text-3xl text-brand-black mt-1">
              {data?.totalParticipants || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {data?.submittedCount || 0} Submitted • {data?.inProgressCount || 0} Active
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border-3 border-brand-black shadow-editorial">
            <p className="font-mono text-xs font-bold text-slate-500 uppercase">Highest Score</p>
            <p className="font-display font-black text-3xl text-burnt-orange mt-1">
              {data?.highestScore || 0} Pts
            </p>
            <p className="text-xs text-slate-500 mt-1">Rank #1 score achieved</p>
          </div>

          <div className="bg-white p-5 rounded-xl border-3 border-brand-black shadow-editorial">
            <p className="font-mono text-xs font-bold text-slate-500 uppercase">Average Score</p>
            <p className="font-display font-black text-3xl text-vibrant-pink mt-1">
              {data?.averageScore || 0} Pts
            </p>
            <p className="text-xs text-slate-500 mt-1">Across submitted exams</p>
          </div>

          <div className="bg-white p-5 rounded-xl border-3 border-brand-black shadow-editorial">
            <p className="font-mono text-xs font-bold text-slate-500 uppercase">Tie-Breaker Rule</p>
            <p className="font-display font-black text-sm text-deep-blue mt-1">
              Score DESC, Submitted ASC
            </p>
            <p className="text-xs text-slate-500 mt-1">Server timestamp authoritative</p>
          </div>
        </div>

        {/* LEADERBOARD TABLE */}
        <div className="bg-white rounded-2xl border-4 border-brand-black shadow-editorial-lg overflow-hidden">
          <div className="bg-brand-black text-white px-6 py-4 flex items-center justify-between border-b-4 border-brand-black">
            <h3 className="font-display font-black text-xl uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-5 h-5 text-burnt-orange" /> Official Student Rankings
            </h3>
            <span className="font-mono text-xs text-slate-400">
              Sorted Server-Side • Zero Client Timestamp Overrides
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center font-mono text-slate-500 font-bold">
              Generating dynamic leaderboard...
            </div>
          ) : !data || data.leaderboard.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-sans">
              No exam submissions recorded for this paper yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-warm-beige border-b-3 border-brand-black font-display font-black text-xs uppercase tracking-wider text-brand-black">
                    <th className="py-3.5 px-6">Rank</th>
                    <th className="py-3.5 px-6">Student Name</th>
                    <th className="py-3.5 px-6">Username</th>
                    <th className="py-3.5 px-6">Course</th>
                    <th className="py-3.5 px-6">Score</th>
                    <th className="py-3.5 px-6">Percentage</th>
                    <th className="py-3.5 px-6">Submission Time</th>
                    <th className="py-3.5 px-6">Tie Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-200 font-sans text-sm">
                  {data.leaderboard.map((entry) => (
                    <tr
                      key={entry.attemptId}
                      className={`hover:bg-warm-beige/50 transition-colors ${
                        entry.rank === 1
                          ? 'bg-amber-50 font-semibold'
                          : entry.rank === 2
                          ? 'bg-slate-50'
                          : entry.rank === 3
                          ? 'bg-orange-50/50'
                          : ''
                      }`}
                    >
                      <td className="py-4 px-6 font-display font-black text-base">
                        {entry.rank === 1 && <span className="inline-block mr-1 text-amber-500">🥇</span>}
                        {entry.rank === 2 && <span className="inline-block mr-1 text-slate-400">🥈</span>}
                        {entry.rank === 3 && <span className="inline-block mr-1 text-amber-700">🥉</span>}
                        #{entry.rank}
                      </td>
                      <td className="py-4 px-6 font-bold text-brand-black">{entry.studentName}</td>
                      <td className="py-4 px-6 font-mono text-xs">{entry.username}</td>
                      <td className="py-4 px-6">{entry.course}</td>
                      <td className="py-4 px-6 font-mono font-black text-burnt-orange">
                        {entry.score} / {entry.totalMarks}
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-vibrant-pink">
                        {entry.percentage}%
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-600">
                        {new Date(entry.submittedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-4 px-6 text-xs">
                        {entry.tieReason ? (
                          <span className="inline-block bg-burnt-orange-light text-burnt-orange border border-burnt-orange px-2.5 py-1 rounded-md font-mono font-bold">
                            {entry.tieReason}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
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
