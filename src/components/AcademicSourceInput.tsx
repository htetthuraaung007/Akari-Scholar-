import React, { useState } from 'react';
import { resolveAcademicPayload, ResolvedAcademicPaper } from '../services/academicResolver';
import { extractTextFromPdfFile } from '../utils/pdfReader';

interface AcademicSourceInputProps {
  onSourceLoaded: (paper: ResolvedAcademicPaper) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  modeLabel?: string; // e.g., "Methodology စစ်ဆေးရန်" or "Matrix ထဲ ထည့်ရန်"
}

export const AcademicSourceInput: React.FC<AcademicSourceInputProps> = ({
  onSourceLoaded,
  isLoading,
  setIsLoading,
  modeLabel = "စာတမ်း ဖတ်မည်"
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Resolve DOI or Web URL
  const handleResolveUrl = async () => {
    if (!inputUrl.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const resolved = await resolveAcademicPayload(inputUrl.trim());
      onSourceLoaded(resolved);
      setInputUrl('');
    } catch (err: any) {
      setErrorMsg(err.message || 'စာတမ်းဆွဲယူရာတွင် အမှားအယွင်းရှိပါသည်');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Parse PDF File client-side
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const fullText = await extractTextFromPdfFile(file);

      onSourceLoaded({
        title: file.name.replace(/\.[^/.]+$/, ""),
        fullText: fullText.substring(0, 30000),
        sourceType: 'open_access_pdf',
        isTruncated: false
      });
      // Reset input value so same file can be uploaded again if needed
      e.target.value = '';
    } catch (err: any) {
      setErrorMsg('PDF ဖတ်မရပါ။ ဖိုင်ပျက်နေခြင်း သို့မဟုတ် Password ခတ်ထားခြင်း ဖြစ်နိုင်ပါသည်။');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
      {/* Title / Instructions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <span>🔗</span> DOI / URL သို့မဟုတ် PDF ဖိုင် တင်သွင်းပါ:
        </span>
        <span className="text-[10px] text-slate-400">
          (DOI, PMC, CDC, WHO, OpenStax သို့မဟုတ် ဒေါင်းလုဒ်လုပ်ထားသော PDF)
        </span>
      </div>

      {/* Input Row: URL / DOI Input + PDF Upload Button */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        {/* URL / DOI input */}
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResolveUrl()}
            placeholder="e.g. 10.1016/... သို့မဟုတ် https://pmc.ncbi.nlm.nih.gov/... သို့မဟုတ် CDC/WHO link"
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Action Buttons Container */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          {/* Resolve Link Button */}
          <button
            type="button"
            onClick={handleResolveUrl}
            disabled={isLoading || !inputUrl.trim()}
            className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-all shadow-md shadow-indigo-900/20 cursor-pointer"
          >
            {isLoading ? 'ဖတ်ရှုနေသည်...' : modeLabel}
          </button>

          {/* Hidden PDF Input */}
          <label className="flex-1 sm:flex-none cursor-pointer px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition-all">
            <span>📄</span>
            <span>PDF တင်မည်</span>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isLoading}
            />
          </label>
        </div>
      </div>

      {/* Error Message Display */}
      {errorMsg && (
        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
          <span>⚠️</span> {errorMsg}
        </p>
      )}
    </div>
  );
};
