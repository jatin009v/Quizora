'use client';

import React, { useState, useEffect } from 'react';
import { Paper } from '@/types/database';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { Plus, Edit3, Award, Clock, FileText, CheckCircle2, Copy, Send, AlertTriangle, X, Trash2, Download } from 'lucide-react';
import Link from 'next/link';

export default function AdminPapersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>('ALL');

  // Modal State
  const [publishingPaper, setPublishingPaper] = useState<Paper | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessData, setPublishSuccessData] = useState<any | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Paper Delete State
  const [deletingPaper, setDeletingPaper] = useState<Paper | null>(null);
  const [isDeletingPaper, setIsDeletingPaper] = useState(false);
  const [deletePaperError, setDeletePaperError] = useState<string | null>(null);

  const fetchPapers = () => {
    setLoading(true);
    fetch('/api/admin/papers')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPapers(data.papers || []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  const handleOpenPublishModal = (paper: Paper) => {
    setPublishingPaper(paper);
    setPublishSuccessData(null);
    setPublishError(null);
    setCopiedCode(false);
  };

  const handleConfirmPublish = async () => {
    if (!publishingPaper) return;

    setIsPublishing(true);
    setPublishError(null);

    try {
      const res = await fetch(`/api/admin/papers/${publishingPaper.id}/publish`, {
        method: 'POST',
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setPublishSuccessData(json.data);
        fetchPapers();
      } else {
        setPublishError(json.error || 'Failed to publish quiz paper.');
      }
    } catch {
      setPublishError('Network error while publishing paper.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleConfirmDeletePaper = async () => {
    if (!deletingPaper) return;

    setIsDeletingPaper(true);
    setDeletePaperError(null);

    try {
      const res = await fetch(`/api/admin/papers/${deletingPaper.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setDeletingPaper(null);
        fetchPapers();
      } else {
        setDeletePaperError(json.error || 'Failed to delete examination paper.');
      }
    } catch {
      setDeletePaperError('Network error trying to delete paper.');
    } finally {
      setIsDeletingPaper(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredPapers = papers.filter((p) => {
    if (filterStatus === 'ALL') return true;
    return p.status === filterStatus;
  });

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b-4 border-brand-black">
          <div>
            <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
              ADMIN CONTROL PANEL
            </span>
            <h1 className="font-display font-black text-4xl md:text-5xl uppercase text-brand-black mt-2">
              Quiz & Paper Management
            </h1>
            <p className="text-slate-600 font-medium mt-1">
              Create, edit, publish, and monitor DCA examination papers.
            </p>
          </div>

          <Link href="/admin/papers/new">
            <MagneticButton variant="primary" size="lg">
              <Plus className="w-5 h-5 mr-2" /> Create New Quiz Paper
            </MagneticButton>
          </Link>
        </div>

        {/* STATUS FILTER TABS */}
        <div className="flex items-center gap-3 border-b-3 border-brand-black pb-2">
          {(['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`py-2 px-4 rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 transition-all cursor-pointer ${
                filterStatus === st
                  ? 'bg-brand-black text-white border-brand-black shadow-editorial'
                  : 'bg-white text-brand-black border-transparent hover:border-brand-black'
              }`}
            >
              {st} ({st === 'ALL' ? papers.length : papers.filter((p) => p.status === st).length})
            </button>
          ))}
        </div>

        {/* PAPERS LIST GRID */}
        {loading ? (
          <div className="text-center py-20 font-mono text-slate-500 font-bold">
            Loading examination papers...
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border-4 border-brand-black shadow-editorial-lg text-center my-8">
            <FileText className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 className="font-display font-black text-2xl uppercase">No {filterStatus} Papers Found</h3>
            <p className="text-slate-600 max-w-md mx-auto mt-2 mb-6">
              There are no examination papers matching status filter &quot;{filterStatus}&quot;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPapers.map((paper) => (
              <div
                key={paper.id}
                className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between hover:shadow-editorial-lg transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`px-3 py-1 rounded font-mono text-xs font-bold uppercase border-2 border-brand-black ${
                        paper.status === 'PUBLISHED'
                          ? 'bg-emerald-400 text-brand-black'
                          : 'bg-warm-beige text-brand-black'
                      }`}
                    >
                      {paper.status}
                    </span>

                    {paper.access_code && (
                      <button
                        onClick={() => copyToClipboard(paper.access_code!)}
                        className="flex items-center gap-1.5 bg-vibrant-pink-light border-2 border-vibrant-pink text-vibrant-pink px-2.5 py-1 rounded font-mono font-bold text-xs cursor-pointer hover:bg-vibrant-pink hover:text-white transition-colors"
                      >
                        <code>{paper.access_code}</code> <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="font-display font-black text-xl text-brand-black leading-tight mb-2">
                    {paper.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-4">
                    {paper.description || 'No description provided.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-warm-beige p-3 rounded-lg border-2 border-brand-black mb-4">
                    <div>
                      <span className="text-slate-500 block">Questions:</span>
                      <span className="font-bold text-brand-black">{paper.required_question_count || 50} Qs</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Marks:</span>
                      <span className="font-bold text-burnt-orange">{paper.total_marks} Marks</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Duration:</span>
                      <span className="font-bold text-brand-black">{paper.duration_minutes} Mins</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status:</span>
                      <span className="font-bold text-vibrant-pink">{paper.status}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t-2 border-slate-200">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/papers/${paper.id}/edit`} className="flex-1">
                      <button className="w-full py-2 px-3 bg-warm-beige hover:bg-warm-beige-dark text-brand-black rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial flex items-center justify-center gap-1 cursor-pointer">
                        <Edit3 className="w-4 h-4" /> Edit
                      </button>
                    </Link>

                    <Link href={`/admin/papers/${paper.id}/results`} className="flex-1">
                      <button className="w-full py-2 px-3 bg-deep-blue hover:bg-deep-blue-dark text-white rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial flex items-center justify-center gap-1 cursor-pointer">
                        <Award className="w-4 h-4" /> Results
                      </button>
                    </Link>

                    <button
                      onClick={() => {
                        setDeletingPaper(paper);
                        setDeletePaperError(null);
                      }}
                      className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial flex items-center justify-center gap-1 cursor-pointer"
                      title="Delete Examination Paper"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {paper.status === 'PUBLISHED' && (
                    <a
                      href={`/api/admin/papers/${paper.id}/export-csv`}
                      download
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download Results CSV
                    </a>
                  )}

                  {paper.status === 'DRAFT' && (
                    <button
                      onClick={() => handleOpenPublishModal(paper)}
                      className="w-full py-2 px-3 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Send className="w-4 h-4" /> Publish Paper & Generate Access Code
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PUBLISH CONFIRMATION MODAL */}
        {publishingPaper && (
          <div className="fixed inset-0 bg-brand-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-lg w-full rounded-3xl border-4 border-brand-black shadow-editorial-lg p-6 space-y-6 relative">
              <button
                onClick={() => setPublishingPaper(null)}
                className="absolute right-4 top-4 p-1 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>

              {!publishSuccessData ? (
                <>
                  <div className="flex items-center gap-3 border-b-2 border-brand-black pb-3">
                    <Send className="w-6 h-6 text-burnt-orange" />
                    <h3 className="font-display font-black text-2xl uppercase">Publish Confirmation</h3>
                  </div>

                  <p className="text-sm font-sans text-slate-700">
                    Are you sure you want to publish <strong className="text-brand-black">{publishingPaper.title}</strong>? Once published, a cryptographically secure access code will be generated for student authentication.
                  </p>

                  <div className="bg-warm-beige p-4 rounded-xl border-2 border-brand-black space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Course:</span>
                      <span className="font-bold text-brand-black">{publishingPaper.course}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Questions:</span>
                      <span className="font-bold text-brand-black">{publishingPaper.required_question_count} Qs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Marks:</span>
                      <span className="font-bold text-burnt-orange">{publishingPaper.total_marks} Marks</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Duration:</span>
                      <span className="font-bold text-brand-black">{publishingPaper.duration_minutes} Mins</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-300">
                      <span className="text-slate-600">Student Result:</span>
                      <span className={`font-bold ${publishingPaper.show_result_to_student ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {publishingPaper.show_result_to_student ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Access Window:</span>
                      <span className="font-bold text-brand-black">
                        {publishingPaper.start_at && publishingPaper.end_at
                          ? `${new Date(publishingPaper.start_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} to ${new Date(publishingPaper.end_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                          : 'No Access Window'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Question Shuffle:</span>
                      <span className={`font-bold ${publishingPaper.shuffle_questions !== false ? 'text-burnt-orange' : 'text-slate-700'}`}>
                        {publishingPaper.shuffle_questions !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {publishError && (
                    <div className="p-3 bg-red-100 border-2 border-red-500 rounded-lg text-xs font-mono font-bold text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> {publishError}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setPublishingPaper(null)}
                      className="flex-1 py-3 px-4 bg-warm-beige hover:bg-warm-beige-dark text-brand-black rounded-xl font-display font-bold text-xs uppercase border-2 border-brand-black shadow-editorial cursor-pointer"
                    >
                      Cancel
                    </button>

                    <MagneticButton
                      variant="primary"
                      size="md"
                      onClick={handleConfirmPublish}
                      disabled={isPublishing}
                      className="flex-1"
                    >
                      {isPublishing ? 'Publishing...' : 'Publish Quiz Now'}
                    </MagneticButton>
                  </div>
                </>
              ) : (
                <div className="space-y-6 text-center">
                  <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />
                  <div>
                    <h3 className="font-display font-black text-2xl uppercase text-brand-black">
                      Quiz Published Successfully!
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Share the access code below with enrolled students.</p>
                  </div>

                  <div className="bg-vibrant-pink-light border-3 border-vibrant-pink p-6 rounded-2xl space-y-3">
                    <span className="text-xs font-mono font-bold text-vibrant-pink uppercase">Official Access Code</span>
                    <div className="font-mono font-black text-4xl text-brand-black tracking-widest">
                      {publishSuccessData.accessCode}
                    </div>
                    <button
                      onClick={() => copyToClipboard(publishSuccessData.accessCode)}
                      className="py-2 px-4 bg-vibrant-pink text-white rounded-lg font-mono text-xs font-bold uppercase shadow-editorial hover:bg-vibrant-pink-hover inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" /> {copiedCode ? 'Copied to Clipboard! ✓' : 'Copy Access Code'}
                    </button>
                  </div>

                  <button
                    onClick={() => setPublishingPaper(null)}
                    className="w-full py-3 px-4 bg-brand-black text-white rounded-xl font-display font-bold text-xs uppercase border-2 border-brand-black shadow-editorial cursor-pointer"
                  >
                    Done & Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAPER DELETE MODAL */}
        {deletingPaper && (
          <div className="fixed inset-0 bg-brand-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white max-w-md w-full rounded-2xl border-4 border-brand-black shadow-editorial-lg p-6 space-y-6">
              <div className="flex items-center gap-3 border-b-3 border-brand-black pb-4 text-red-600">
                <AlertTriangle className="w-7 h-7" />
                <h3 className="font-display font-black text-xl uppercase">Delete Examination?</h3>
              </div>

              {deletePaperError && (
                <div className="p-3 bg-red-100 border-2 border-red-500 text-red-900 font-mono text-xs font-bold rounded-lg">
                  {deletePaperError}
                </div>
              )}

              <p className="text-sm font-sans text-slate-700 leading-relaxed">
                This will permanently remove examination <strong className="text-brand-black">{deletingPaper.title}</strong> and associated exam attempts, answers, and proctor events.
              </p>

              <div className="bg-emerald-50 border-2 border-emerald-400 p-3 rounded-xl font-mono text-xs text-emerald-900 space-y-1">
                <p>✅ <strong>Question Bank Preserved:</strong> Questions in the Question Bank will NOT be deleted and remain available for reuse in future papers.</p>
              </div>

              <div className="bg-warm-beige p-3 rounded-xl border-2 border-brand-black font-mono text-xs text-slate-600">
                ⚠️ Active exams with student attempts in progress cannot be deleted.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  disabled={isDeletingPaper}
                  onClick={() => setDeletingPaper(null)}
                  className="py-2 px-4 rounded-xl border-2 border-brand-black font-mono text-xs font-bold uppercase hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isDeletingPaper}
                  onClick={handleConfirmDeletePaper}
                  className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold uppercase rounded-xl border-2 border-brand-black shadow-editorial cursor-pointer"
                >
                  {isDeletingPaper ? 'Deleting...' : 'Delete Examination'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
