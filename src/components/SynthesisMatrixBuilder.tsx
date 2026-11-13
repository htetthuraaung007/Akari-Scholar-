import React, { useState, useEffect } from 'react';
import { fetchPaperMetadata, IngestedPaper } from '../services/academicResolver';
import { generateStructuredSynthesis, CompleteSynthesisResult } from '../services/synthesisGeminiService';
import { Table as TableIcon, Copy, Download, Sparkles, Check } from 'lucide-react';
import {
  loadPersistedTabState,
  savePersistedTabState,
  clearPersistedTabState,
} from '../utils/researchPersistence';
import { ResearchClearAction } from './ResearchClearAction';

interface Tab3PersistedState {
  inputUrl: string;
  ingestedPapers: IngestedPaper[];
  activeTab: 'matrix' | 'thematic';
  viewMode: 'table' | 'cards';
  synthesisResult: CompleteSynthesisResult | null;
}

const TAB3_STORAGE_KEY = 'matrix_tab3_data';
const TAB3_DEFAULT_STATE: Tab3PersistedState = {
  inputUrl: '',
  ingestedPapers: [],
  activeTab: 'matrix',
  viewMode: 'table',
  synthesisResult: null,
};

export const SynthesisMatrixBuilder: React.FC = () => {
  const [initialState] = useState<Tab3PersistedState>(() =>
    loadPersistedTabState<Tab3PersistedState>(TAB3_STORAGE_KEY, TAB3_DEFAULT_STATE)
  );
  const [inputUrl, setInputUrl] = useState(initialState.inputUrl);
  const [ingestedPapers, setIngestedPapers] = useState<IngestedPaper[]>(initialState.ingestedPapers);
  const [activeTab, setActiveTab] = useState<'matrix' | 'thematic'>(initialState.activeTab);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(initialState.viewMode);
  const [isLoading, setIsLoading] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<CompleteSynthesisResult | null>(
    initialState.synthesisResult
  );
  const [fallbackModalPaper, setFallbackModalPaper] = useState<IngestedPaper | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    savePersistedTabState<Tab3PersistedState>(TAB3_STORAGE_KEY, {
      inputUrl,
      ingestedPapers,
      activeTab,
      viewMode,
      synthesisResult,
    });
  }, [inputUrl, ingestedPapers, activeTab, viewMode, synthesisResult]);

  const handleClearAll = () => {
    setInputUrl('');
    setIngestedPapers([]);
    setSynthesisResult(null);
    setFallbackModalPaper(null);
    setActiveTab('matrix');
    setViewMode('table');
    clearPersistedTabState(TAB3_STORAGE_KEY);
  };

  // Ingest DOI / Web link
  const handleIngestPaper = async () => {
    if (!inputUrl.trim()) return;
    setIsLoading(true);
    try {
      const paper = await fetchPaperMetadata(inputUrl.trim());
      if (paper.isFallbackNeeded) {
        setFallbackModalPaper(paper);
      } else {
        setIngestedPapers(prev => [...prev, paper]);
      }
      setInputUrl('');
    } catch {
      alert('Error fetching paper details. Please paste the abstract manually.');
    } finally {
      setIsLoading(false);
    }
  };

  // Run Synthesis
  const handleRunSynthesis = async () => {
    const key = localStorage.getItem('akari_gemini_api_key_primary') || '';
    if (ingestedPapers.length < 2) {
      alert('သုတေသန နှိုင်းယှဉ်ဇယား ထုတ်ရန် အနည်းဆုံး စာတမ်း (၂) စောင် လိုအပ်ပါသည်ခင်ဗျာ။');
      return;
    }
    setIsLoading(true);
    try {
      const result = await generateStructuredSynthesis(ingestedPapers, key);
      setSynthesisResult(result);
    } catch (e: any) {
      alert(e.message || 'Synthesis ထုတ်ယူရာတွင် အမှားအယွင်းရှိပါသည်');
    } finally {
      setIsLoading(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!synthesisResult) return;
    const headers = [
      'Author & Year',
      'Research Design',
      'Key Findings',
      'Limitations',
      'Direct Replicability / Fit',
    ];
    const rows = synthesisResult.matrixRows.map((r) => [
      `"${(r.authorYear || '').replace(/"/g, '""')}"`,
      `"${(r.researchDesign || r.methodology || '').replace(/"/g, '""')}"`,
      `"${(r.keyFindings || '').replace(/"/g, '""')}"`,
      `"${(r.limitations || '').replace(/"/g, '""')}"`,
      `"${(r.directReplicabilityFit || r.identifiedGap || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Synthesis_Matrix_${Date.now()}.csv`);
    link.click();
  };

  const buildMarkdownTable = (): string => {
    if (!synthesisResult) return '';
    const header =
      '| Author & Year | Research Design | Key Findings | Limitations | Direct Replicability / Fit |\n| --- | --- | --- | --- | --- |';
    const body = synthesisResult.matrixRows
      .map(
        (r) =>
          `| ${r.authorYear} | ${r.researchDesign || r.methodology} | ${r.keyFindings} | ${r.limitations} | ${r.directReplicabilityFit || r.identifiedGap} |`
      )
      .join('\n');
    return `${header}\n${body}\n\n### Thematic Synthesis Summary\n${synthesisResult.thematicAnalysis.synthesisSummary}`;
  };

  const handleLoadSamplePapers = () => {
    const samplePapers: IngestedPaper[] = [
      {
        id: `sample-1-${Date.now()}`,
        doiOrUrl: '10.1016/j.compedu.2023.104812',
        title: 'Metacognitive Scaffolding and Retrieval Practice in Asynchronous Online Higher Education',
        authors: 'Roediger, H. L., & Karpicke, J. D.',
        year: '2023',
        source: 'crossref',
        abstract:
          'Randomized controlled cohort study (N = 680 university learners) evaluating weekly spaced retrieval quizzes versus passive rereading. Findings demonstrated a significant improvement in long-term conceptual transfer (Cohen d = 0.72, p < 0.001), though self-regulated participation declined slightly in unmoderated cohorts.',
        isFallbackNeeded: false,
      },
      {
        id: `sample-2-${Date.now() + 1}`,
        doiOrUrl: '10.1037/edu0000794',
        title: 'Peer Assessment Rubric Calibration and Critical Writing Gains in Global Virtual Classrooms',
        authors: 'Panadero, E., & Jonsson, A.',
        year: '2024',
        source: 'semanticscholar',
        abstract:
          'Mixed-methods longitudinal analysis across 1,120 undergraduate students examining structured rubric exemplars in peer-reviewed writing assignments. Structured rubric calibration increased analytical argument coherence by 34% (p = 0.002), with minor variance across non-native English speaking subgroups.',
        isFallbackNeeded: false,
      },
    ];
    setIngestedPapers(samplePapers);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5 tracking-tight">
          <TableIcon className="w-6 h-6 text-indigo-400" />
          <span>Literature Synthesis Matrix & Thematic Analysis</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Multi-source academic paper ingestion, structured comparison matrix (Author & Year, Research Design, Key Findings, Limitations, Direct Replicability / Fit), and thematic synthesis.
        </p>
      </div>

      {/* Step 1: Input Ingestion Bar */}
      <div className="p-5 rounded-3xl bg-[#0c1222]/90 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span>🔗</span> DOI / URL ထည့်သွင်းပါ (Semantic Scholar, Crossref, OpenAlex Auto-Pull)
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleLoadSamplePapers}
              className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              + နမူနာ စာတမ်း (၂) စောင် ထည့်မည် (Load Sample Papers)
            </button>
            <span className="text-[11px] font-semibold text-indigo-400">
              {ingestedPapers.length} Papers Added (အနည်းဆုံး ၂ စောင် လိုအပ်သည်)
            </span>
            {(inputUrl || ingestedPapers.length > 0 || synthesisResult) && (
              <ResearchClearAction onConfirmClear={handleClearAll} />
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleIngestPaper()}
            placeholder="e.g. 10.1016/j.lana.2024.100746 သို့မဟုတ် DOI / PubMed / Research URL"
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
          <button
            onClick={handleIngestPaper}
            disabled={isLoading || !inputUrl.trim()}
            className="px-5 py-2.5 text-xs sm:text-sm font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-all shrink-0 shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            {isLoading ? 'ဆွဲယူနေသည်...' : '+ စာတမ်း ထည့်မည်'}
          </button>
        </div>

        {/* Paper Chips List */}
        {ingestedPapers.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {ingestedPapers.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-slate-900 border border-slate-700 text-xs text-slate-200 shadow-sm"
              >
                <span className="font-bold text-indigo-400 font-mono">P{idx + 1}:</span>
                <span className="truncate max-w-[220px]" title={p.title}>
                  {p.title}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {p.source}
                </span>
                <button
                  onClick={() => setIngestedPapers(ingestedPapers.filter((x) => x.id !== p.id))}
                  className="text-slate-500 hover:text-rose-400 text-xs ml-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Run Matrix Button */}
        {ingestedPapers.length >= 2 && (
          <div className="pt-3 flex justify-end">
            <button
              onClick={handleRunSynthesis}
              disabled={isLoading}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-indigo-900/40 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? 'Matrix တွက်ချက်နေသည်...' : 'Synthesis Matrix ထုတ်မည်'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Manual Abstract Modal Fallback */}
      {fallbackModalPaper && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-amber-500/40 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <span>⚠️</span> Abstract စာသား ထည့်သွင်းပေးပါ
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              ထည့်သွင်းလိုက်သော DOI/URL မှ Abstract ကို တိုက်ရိုက် မဆွဲယူနိုင်ပါသဖြင့် အဆိုပါ စာတမ်း၏ Abstract စာသားကို အောက်တွင် Paste ချပေးပါခင်ဗျာ။
            </p>
            <textarea
              rows={6}
              placeholder="Paste Abstract text here..."
              className="w-full p-3.5 text-xs rounded-2xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
              onChange={(e) => {
                fallbackModalPaper.abstract = e.target.value;
              }}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setFallbackModalPaper(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                onClick={() => {
                  if (!fallbackModalPaper.abstract.trim()) return;
                  setIngestedPapers((prev) => [...prev, fallbackModalPaper]);
                  setFallbackModalPaper(null);
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30 cursor-pointer"
              >
                အတည်ပြုမည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Interactive Output */}
      {synthesisResult && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#0c1222]/90 border border-slate-800 space-y-5 shadow-2xl">
          {/* Top Panel Bar */}
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-800">
            {/* Sub-Tabs Switcher */}
            <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'matrix'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📊 Synthesis Matrix (နှိုင်းယှဉ်ဇယား)
              </button>
              <button
                onClick={() => setActiveTab('thematic')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'thematic'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🧠 Thematic Synthesis (သုံးသပ်ချက်)
              </button>
            </div>

            {/* Quick Actions (Export / Copy Markdown) */}
            <div className="flex items-center gap-2 flex-wrap">
              {activeTab === 'matrix' && (
                <button
                  onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                >
                  {viewMode === 'table' ? '📱 Card View' : '🖥️ Table View'}
                </button>
              )}
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => handleCopyText(buildMarkdownTable(), 'md-table')}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedId === 'md-table' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedId === 'md-table' ? 'Copied Markdown' : 'Copy Markdown Table'}</span>
              </button>
            </div>
          </div>

          {/* Sub-Tab 1: Synthesis Matrix View */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              {viewMode === 'table' ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-2xl">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-200 font-bold border-b border-slate-800">
                        <th className="p-3.5 w-48 sticky left-0 bg-slate-900 z-10">Author & Year</th>
                        <th className="p-3.5 min-w-[200px]">Research Design</th>
                        <th className="p-3.5 min-w-[240px]">Key Findings</th>
                        <th className="p-3.5 min-w-[190px]">Limitations</th>
                        <th className="p-3.5 min-w-[210px]">Direct Replicability / Fit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {synthesisResult.matrixRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={
                            idx % 2 === 0
                              ? 'bg-slate-950/40 hover:bg-slate-850/50'
                              : 'bg-slate-900/20 hover:bg-slate-850/50'
                          }
                        >
                          <td className="p-3.5 font-bold text-indigo-300 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                            {row.authorYear}
                          </td>
                          <td className="p-3.5 text-cyan-300 leading-relaxed font-medium">
                            {row.researchDesign || `${row.methodology} (${row.sampleDataset})`}
                          </td>
                          <td className="p-3.5 text-emerald-300 leading-relaxed font-medium">
                            {row.keyFindings}
                          </td>
                          <td className="p-3.5 text-amber-300/90 leading-relaxed">
                            {row.limitations}
                          </td>
                          <td className="p-3.5 text-purple-300 leading-relaxed">
                            {row.directReplicabilityFit || row.identifiedGap}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Card View for Mobile */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {synthesisResult.matrixRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs sm:text-sm shadow-xl"
                    >
                      <h4 className="font-extrabold text-base text-indigo-300 pb-2 border-b border-slate-800">
                        {row.authorYear}
                      </h4>
                      <p>
                        <strong className="text-slate-400">Research Design:</strong>{' '}
                        <span className="text-cyan-300">
                          {row.researchDesign || `${row.methodology} (${row.sampleDataset})`}
                        </span>
                      </p>
                      <p>
                        <strong className="text-slate-400">Key Findings:</strong>{' '}
                        <span className="text-emerald-300">{row.keyFindings}</span>
                      </p>
                      <p>
                        <strong className="text-slate-400">Limitations:</strong>{' '}
                        <span className="text-amber-300">{row.limitations}</span>
                      </p>
                      <p>
                        <strong className="text-slate-400">Direct Replicability / Fit:</strong>{' '}
                        <span className="text-purple-300">
                          {row.directReplicabilityFit || row.identifiedGap}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Synthesized Thematic Summary directly visible beneath comparison table */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <span>🧬</span> Synthesized Thematic Summary (Consensus vs. Divergent Evidence)
                  </span>
                  <button
                    onClick={() =>
                      handleCopyText(
                        synthesisResult.thematicAnalysis.synthesisSummary,
                        'inline-summary'
                      )
                    }
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'inline-summary' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === 'inline-summary' ? 'Copied' : 'Copy Summary'}</span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
                  "{synthesisResult.thematicAnalysis.synthesisSummary}"
                </p>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Thematic Synthesis View */}
          {activeTab === 'thematic' && (
            <div className="space-y-4 font-sans">
              {/* Common Threads */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 shadow-lg">
                <h4 className="text-xs sm:text-sm font-bold text-indigo-300 flex items-center gap-2 uppercase tracking-wide">
                  <span>🧵</span> Common Thematic Threads (တူညီသော တွေ့ရှိချက်များနှင့် အဓိက အကြောင်းအရာများ)
                </h4>
                <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {synthesisResult.thematicAnalysis.commonThreads.map((thread, i) => (
                    <li key={i}>{thread}</li>
                  ))}
                </ul>
              </div>

              {/* Conflicting Findings */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 shadow-lg">
                <h4 className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-2 uppercase tracking-wide">
                  <span>⚖️</span> Divergence & Conflicting Findings (ကွဲလွဲချက်များနှင့် ကန့်သတ်ချက်များ)
                </h4>
                <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {synthesisResult.thematicAnalysis.conflictingFindings.map((conflict, i) => (
                    <li key={i}>{conflict}</li>
                  ))}
                </ul>
              </div>

              {/* Comprehensive Synthesis Essay Paragraph */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-950/60 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-cyan-300 flex items-center gap-2 uppercase tracking-wide">
                    <span>📝</span> Scholarly Synthesis Paragraph (Assignment အတွက် စာပိုဒ်ကြမ်း)
                  </h4>
                  <button
                    onClick={() =>
                      handleCopyText(
                        synthesisResult.thematicAnalysis.synthesisSummary,
                        'thematic-summary'
                      )
                    }
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'thematic-summary' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === 'thematic-summary' ? 'Copied' : 'ကော်ပီယူမည်'}</span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                  "{synthesisResult.thematicAnalysis.synthesisSummary}"
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
