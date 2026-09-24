import React from 'react';

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-canvas text-brand-black flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl border-4 border-brand-black shadow-editorial text-center space-y-4 max-w-sm">
        <div className="w-10 h-10 border-4 border-burnt-orange border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="font-display font-black text-lg uppercase tracking-wider">Loading Control Panel...</p>
      </div>
    </div>
  );
}
