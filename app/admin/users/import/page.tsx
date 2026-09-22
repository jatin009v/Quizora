'use client';

import React, { useState } from 'react';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft, RefreshCw, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [previewData, setPreviewData] = useState<any | null>(null);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewData(null);
      setExecutionResult(null);
      setErrorMessage(null);
    }
  };

  const handleAnalyzeExcel = async () => {
    if (!file) return;

    setAnalyzing(true);
    setErrorMessage(null);
    setPreviewData(null);
    setExecutionResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/users/import/preview', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setPreviewData(json);
      } else {
        setErrorMessage(json.error || 'Failed to analyze Excel file.');
      }
    } catch {
      setErrorMessage('Network error while analyzing file.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!file || !previewData) return;

    setExecuting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/users/import/execute', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setExecutionResult(json.data);
      } else {
        setErrorMessage(json.error || 'Bulk account creation failed.');
      }
    } catch {
      setErrorMessage('Network error during bulk creation.');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4 border-b-4 border-brand-black pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/users"
              className="p-2.5 bg-white border-2 border-brand-black rounded-lg shadow-editorial hover:bg-warm-beige transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-brand-black" />
            </Link>
            <div>
              <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
                BULK ENGINE
              </span>
              <h1 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black mt-1">
                Bulk Excel Student Import (200+ Users)
              </h1>
            </div>
          </div>
        </div>

        {/* UPLOAD & PARSE CARD */}
        <div className="bg-white p-8 rounded-2xl border-4 border-brand-black shadow-editorial-lg space-y-6">
          <h2 className="font-display font-black text-2xl uppercase border-b-2 border-brand-black pb-3">
            1. Select Excel File (.xlsx / .xls)
          </h2>

          <div className="border-3 border-dashed border-brand-black rounded-2xl p-8 text-center bg-warm-beige/30 space-y-4">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-burnt-orange" />
            <div>
              <p className="font-display font-bold text-lg text-brand-black">
                {file ? file.name : 'Drag and drop Excel spreadsheet here'}
              </p>
              <p className="text-xs font-mono text-slate-500 mt-1">
                Required Columns: <code className="bg-warm-beige border border-slate-300 px-1.5 py-0.5 rounded text-brand-black font-bold">name</code>, <code className="bg-warm-beige border border-slate-300 px-1.5 py-0.5 rounded text-brand-black font-bold">course</code>, <code className="bg-warm-beige border border-slate-300 px-1.5 py-0.5 rounded text-brand-black font-bold">roll_number</code>, <code className="bg-warm-beige border border-slate-300 px-1.5 py-0.5 rounded text-brand-black font-bold">username</code>, <code className="bg-warm-beige border border-slate-300 px-1.5 py-0.5 rounded text-brand-black font-bold">password</code>
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                id="excel-input"
                className="hidden"
              />
              <label
                htmlFor="excel-input"
                className="py-2.5 px-4 bg-white border-2 border-brand-black rounded-lg font-mono text-xs font-bold uppercase shadow-editorial hover:bg-warm-beige cursor-pointer"
              >
                Choose File
              </label>

              {file && (
                <MagneticButton
                  variant="primary"
                  size="md"
                  onClick={handleAnalyzeExcel}
                  disabled={analyzing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                  {analyzing ? 'Validating File...' : 'Analyze & Preview Excel'}
                </MagneticButton>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-red-100 border-2 border-red-500 rounded-xl text-xs font-mono font-bold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" /> {errorMessage}
            </div>
          )}
        </div>

        {/* PHASE 2: PREVIEW & VALIDATION SUMMARY */}
        {previewData && (
          <div className="bg-white rounded-2xl border-4 border-brand-black shadow-editorial-lg overflow-hidden space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-3 border-brand-black pb-4">
              <div>
                <h3 className="font-display font-black text-2xl uppercase">2. Pre-Import Validation Preview</h3>
                <p className="text-xs font-mono text-slate-500">
                  Review rows before clicking Create Valid Users
                </p>
              </div>

              <MagneticButton
                variant="primary"
                size="lg"
                onClick={handleExecuteImport}
                disabled={executing || previewData.validCount === 0}
                className="flex items-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                {executing ? 'Creating Accounts...' : `Create ${previewData.validCount} Valid Users`}
              </MagneticButton>
            </div>

            {/* PREVIEW COUNTERS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="bg-warm-beige p-4 rounded-xl border-2 border-brand-black">
                <span className="text-slate-500 block">Total Rows:</span>
                <span className="font-display font-black text-2xl text-brand-black">{previewData.totalRows}</span>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-500">
                <span className="text-emerald-700 block font-bold">Valid Rows:</span>
                <span className="font-display font-black text-2xl text-emerald-800">{previewData.validCount}</span>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border-2 border-amber-500">
                <span className="text-amber-700 block font-bold">Duplicate Rows:</span>
                <span className="font-display font-black text-2xl text-amber-800">{previewData.duplicateCount}</span>
              </div>
              <div className="bg-red-50 p-4 rounded-xl border-2 border-red-500">
                <span className="text-red-700 block font-bold">Invalid Rows:</span>
                <span className="font-display font-black text-2xl text-red-800">{previewData.invalidCount}</span>
              </div>
            </div>

            {/* PREVIEW TABLE */}
            <div className="max-h-[360px] overflow-y-auto border-2 border-brand-black rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-warm-beige sticky top-0 border-b-2 border-brand-black font-display font-black uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Row #</th>
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Course</th>
                    <th className="py-2.5 px-4">Roll Number</th>
                    <th className="py-2.5 px-4">Username</th>
                    <th className="py-2.5 px-4">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {previewData.preview.map((row: any) => (
                    <tr key={row.rowNumber} className={row.isValid ? 'bg-white' : 'bg-red-50/50'}>
                      <td className="py-2.5 px-4 font-bold">#{row.rowNumber}</td>
                      <td className="py-2.5 px-4">{row.name}</td>
                      <td className="py-2.5 px-4">{row.course}</td>
                      <td className="py-2.5 px-4">{row.rollNumber}</td>
                      <td className="py-2.5 px-4 text-burnt-orange font-bold">{row.username}</td>
                      <td className="py-2.5 px-4">
                        {row.isValid ? (
                          <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-400">
                            VALID ✓
                          </span>
                        ) : (
                          <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded border border-red-400">
                            INVALID ({row.reason})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXECUTION SUMMARY RESULT */}
        {executionResult && (
          <div className="bg-emerald-50 border-4 border-emerald-500 p-8 rounded-2xl space-y-4">
            <h3 className="font-display font-black text-2xl text-emerald-900 uppercase flex items-center gap-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" /> Bulk Student Accounts Created!
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono font-bold bg-white p-4 rounded-xl border-2 border-emerald-400">
              <div>
                <span className="text-slate-500 block">Total Input:</span>
                <span className="text-brand-black text-xl font-display">{executionResult.totalRows}</span>
              </div>
              <div>
                <span className="text-emerald-700 block">Created Successfully:</span>
                <span className="text-emerald-800 text-xl font-display">{executionResult.createdCount}</span>
              </div>
              <div>
                <span className="text-amber-700 block">Skipped:</span>
                <span className="text-amber-800 text-xl font-display">{executionResult.skippedCount}</span>
              </div>
              <div>
                <span className="text-red-700 block">Failed:</span>
                <span className="text-red-800 text-xl font-display">{executionResult.failedCount}</span>
              </div>
            </div>

            {executionResult.errors?.length > 0 && (
              <div className="bg-white p-4 rounded-xl border-2 border-red-400 text-xs font-mono space-y-1">
                <span className="font-bold text-red-700 block">Partial Failures:</span>
                {executionResult.errors.map((err: any, i: number) => (
                  <p key={i} className="text-slate-700">
                    Username <strong>{err.username}</strong> ({err.name}): {err.reason}
                  </p>
                ))}
              </div>
            )}

            <Link href="/admin/users">
              <MagneticButton variant="primary" size="md" className="mt-2">
                View Enrolled Student Directory
              </MagneticButton>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
