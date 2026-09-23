'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PaperBuilderForm } from '@/components/admin/PaperBuilderForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function EditPaperPage({ params }: { params: { paperId: string } }) {
  const [paperData, setPaperData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchPaperDetails = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/papers/${params.paperId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPaperData(data);
        } else {
          setErrorMsg(data.error || 'Paper not found');
        }
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg('Failed to load paper details');
      })
      .finally(() => setLoading(false));
  }, [params.paperId]);

  useEffect(() => {
    fetchPaperDetails();
  }, [fetchPaperDetails]);

  const paper = paperData?.paper;
  const questions = paperData?.questions || paperData?.paperQuestions || [];

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* TOP NAV BAR */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/papers"
              className="p-2.5 bg-white border-2 border-brand-black rounded-lg shadow-editorial hover:bg-warm-beige transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-brand-black" />
            </Link>
            <div>
              <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
                EXAMINATION PAPER BUILDER
              </span>
              <h1 className="font-display font-black text-3xl md:text-4xl uppercase text-brand-black mt-1">
                {paper?.title || 'Edit Paper'}
              </h1>
            </div>
          </div>

          {paper && (
            <span
              className={`px-4 py-1.5 rounded-xl font-mono text-xs font-bold uppercase border-2 border-brand-black shadow-editorial ${
                paper.status === 'PUBLISHED'
                  ? 'bg-emerald-400 text-brand-black'
                  : 'bg-warm-beige text-brand-black'
              }`}
            >
              Status: {paper.status}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 font-mono text-slate-500 font-bold">
            Loading examination configuration...
          </div>
        ) : errorMsg || !paper ? (
          <div className="bg-white p-12 rounded-2xl border-4 border-brand-black text-center font-mono font-bold text-red-600">
            {errorMsg || 'Examination Paper Not Found.'}
          </div>
        ) : (
          <PaperBuilderForm
            paperId={params.paperId}
            initialData={{
              ...paper,
              paperQuestions: questions,
            }}
            adminName="Admin Instructor"
            onRefreshData={fetchPaperDetails}
          />
        )}
      </div>
    </div>
  );
}

