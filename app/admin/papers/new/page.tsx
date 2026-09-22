'use client';

import React from 'react';
import { PaperBuilderForm } from '@/components/admin/PaperBuilderForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewPaperPage() {
  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/papers"
            className="p-2.5 bg-white border-2 border-brand-black rounded-lg shadow-editorial hover:bg-warm-beige transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-brand-black" />
          </Link>
          <div>
            <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
              PAPER BUILDER
            </span>
            <h1 className="font-display font-black text-3xl md:text-4xl uppercase text-brand-black mt-1">
              Build New Examination Paper
            </h1>
          </div>
        </div>

        <PaperBuilderForm adminName="Admin Instructor" />
      </div>
    </div>
  );
}
