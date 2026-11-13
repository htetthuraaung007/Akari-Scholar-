import React, { useState, useEffect } from 'react';
import { runMethodologyExtraction, MethodologyOutput } from '../services/methodologyService';
import { fetchPaperMetadata, resolveAcademicPayload } from '../services/academicResolver';
import { extractTextFromPdfFile } from '../utils/pdfReader';
import {
  loadPersistedTabState,
  savePersistedTabState,
  clearPersistedTabState,
} from '../utils/researchPersistence';
import { ResearchClearAction } from './ResearchClearAction';

interface Tab2PersistedState {
  sourceText: string;
  inputUrl: string;
  result: MethodologyOutput | null;
  activeSubTab: 'burmese' | 'english';
}

const TAB2_STORAGE_KEY = 'matrix_tab2_data';
const TAB2_DEFAULT_STATE: Tab2PersistedState = {
  sourceText: '',
  inputUrl: '',
  result: null,
  activeSubTab: 'burmese',
};

export const MethodologyStatsExplainer: React.FC = () => {
  const [initialState] = useState<Tab2PersistedState>(() =>
    loadPersistedTabState<Tab2PersistedState>(TAB2_STORAGE_KEY, TAB2_DEFAULT_STATE)
  );
  const [sourceText, setSourceText] = useState(initialState.sourceText);
  const [inputUrl, setInputUrl] = useState(initialState.inputUrl);
  const [loading, setLoading] = useState(false);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [result, setResult] = useState<MethodologyOutput | null>(initialState.result);
  const [activeSubTab, setActiveSubTab] = useState<'burmese' | 'english'>(initialState.activeSubTab);

  useEffect(() => {
    savePersistedTabState<Tab2PersistedState>(TAB2_STORAGE_KEY, {
      sourceText,
      inputUrl,
      result,
      activeSubTab,
    });
  }, [sourceText, inputUrl, result, activeSubTab]);

  const handleClearAll = () => {
    setSourceText('');
    setInputUrl('');
    setResult(null);
    setActiveSubTab('burmese');
    clearPersistedTabState(TAB2_STORAGE_KEY);
  };

  // 1. Ingest from DOI / Web Link
  const handleResolveUrl = async () => {
    if (!inputUrl.trim()) return;
    setIngestLoading(true);
    try {
      const paper = await fetchPaperMetadata(inputUrl.trim());
      if (paper.abstract && paper.abstract.trim().length > 50) {
        setSourceText(`Title: ${paper.title}\nAuthors: ${paper.authors} (${paper.year})\n\nAbstract / Methodology:\n${paper.abstract}`);
      } else {
        const resolved = await resolveAcademicPayload(inputUrl.trim());
        if (resolved.fullText && resolved.fullText.trim().length > 50) {
          setSourceText(`Title: ${resolved.title}\n\n${resolved.fullText}`);
        } else {
          setSourceText(`Title / DOI: ${paper.doiOrUrl}\n(Abstract could not be pulled automatically. Please paste excerpt below.)`);
        }
      }
      setInputUrl('');
    } catch {
      alert('Link ဖတ်ရှုရာတွင် အမှားအယွင်းရှိပါသည်။');
    } finally {
      setIngestLoading(false);
    }
  };

  // 2. Ingest from Local PDF File
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIngestLoading(true);
    try {
      const extracted = await extractTextFromPdfFile(file);
      setSourceText(`File: ${file.name}\n\n${extracted.substring(0, 15000)}`);
      e.target.value = '';
    } catch {
      alert('PDF ဖတ်မရပါ။ ဖိုင်ပျက်နေခြင်း သို့မဟုတ် ပုံရိပ်သီးသန့် စကင်ဖတ်ထားသော PDF ဖြစ်နိုင်ပါသည်။');
    } finally {
      setIngestLoading(false);
    }
  };

  // 3. Run Analysis
  const handleExplain = async () => {
    if (!sourceText.trim()) return;
    const apiKey = localStorage.getItem('akari_gemini_api_key_primary') || '';

    setLoading(true);
    try {
      const output = await runMethodologyExtraction(sourceText, apiKey);
      setResult(output);
    } catch (err: any) {
      alert(err.message || 'ခွဲခြမ်းစိတ်ဖြာရာတွင် အမှားအယွင်းရှိပါသည်');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* RESTORED: TOP SOURCE INGESTION BAR */}
      <div className="p-3.5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <span>🔗</span> DOI / URL သို့မဟုတ် PDF ဖိုင် တင်သွင်းပါ:
          </span>
          <span className="text-[10px] text-slate-400">
            (DOI, PMC, CDC, WHO, OpenStax သို့မဟုတ် ဒေါင်းလုဒ်လုပ်ထားသော PDF)
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResolveUrl()}
            placeholder="e.g. 10.4103/jfmpc.jfmpc_1903_24 သို့မဟုတ် PubMed / PMC / CDC link"
            className="flex-1 w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={handleResolveUrl}
              disabled={ingestLoading || !inputUrl.trim()}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-all shadow-md cursor-pointer"
            >
              {ingestLoading ? 'ဆွဲယူနေသည်...' : 'Methodology စစ်ဆေးရန်'}
            </button>

            <label className="flex-1 sm:flex-none cursor-pointer px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition-all">
              <span>📄</span>
              <span>PDF တင်မည်</span>
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={ingestLoading}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN WORKSPACE: LEFT INPUT, RIGHT OUTPUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Input Area */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200">သုတေသန ကိန်းဂဏန်း အချက်အလက်များ ထည့်သွင်းရန်</span>
              <button
                onClick={() => setSourceText('Multiple Logistic Regression Model for 4-Year University Degree Completion (N = 1,420):\n- Predictor 1 (Weekly Spaced Retrieval Practice): Odds Ratio (OR) = 2.45, 95% Confidence Interval [1.68, 3.57], p < 0.001.\n- Predictor 2 (Peer Review Rubric Engagement): OR = 1.82, 95% CI [1.24, 2.68], p = 0.002.\n- Covariate (Prior High School GPA): Adjusted Beta = 0.38, standard error (SE) = 0.09, t = 4.22, p < 0.001.\n- Model Fit & Diagnostics: Nagelkerke R² = 0.284, Hosmer-Lemeshow goodness-of-fit test χ² = 7.82, p = 0.45 (adequate fit). ANOVA model comparison against baseline F(3, 1416) = 24.18, p < 0.0001.')}
                className="text-[10px] text-cyan-400 hover:underline font-semibold cursor-pointer"
              >
                နမူနာ ကိန်းဂဏန်းများ ထည့်မည်
              </button>
            </div>
            <textarea
              rows={13}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="စာတမ်းမှ Methodology နှင့် Statistical Results စာသားများကို ကူးထည့်ပါ (သို့မဟုတ် အပေါ်မှ Link/PDF တင်ပါ)..."
              className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            onClick={handleExplain}
            disabled={loading || !sourceText.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>နောက်ကွယ်မှ စိစစ်တွက်ချက်နေသည်...</span>
              </>
            ) : (
              <>
                <span>📊</span>
                <span>ကိန်းဂဏန်းများအား သာမန်စကားပြေဖြင့် ရှင်းပြပါ</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output Area: 3-Part Diagnostic Scorecard */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-emerald-400">
              METHODOLOGY & STATISTICS 3-PART DIAGNOSTIC SCORECARD
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-700/40 font-semibold">
                Dynamic Token-Optimized Engine
              </span>
              {(sourceText || inputUrl || result) && (
                <ResearchClearAction onConfirmClear={handleClearAll} />
              )}
            </div>
          </div>

          {result ? (
            <div className="space-y-4">
              {/* PART 1: 📊 Research Design & Sample Size */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <span>📊</span>
                    <span>1. Research Design & Sample Size</span>
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-700/40">
                    {result.paperType}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Study Design</span>
                    <span className="text-xs font-bold text-emerald-300 block mt-0.5 leading-snug">
                      {result.studyDesign}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Sample Size (N)</span>
                    <span className="text-xs font-bold font-mono text-cyan-300 block mt-0.5">
                      {result.sampleSize}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Alpha Threshold (α)</span>
                    <span className="text-xs font-bold font-mono text-purple-300 block mt-0.5">
                      {result.alphaThreshold || 'α = 0.05'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Analytical Tool</span>
                    <span className="text-xs font-bold text-amber-300 block mt-0.5 leading-snug">
                      {result.analyticalTool}
                    </span>
                  </div>
                </div>

                {result.effectSizeSummary && (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-slate-400">Primary Effect Size Summary:</span>
                    <span className="font-mono text-cyan-300 font-bold">{result.effectSizeSummary}</span>
                  </div>
                )}
              </div>

              {/* PART 2: 📈 Statistical Test Breakdown */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <span>📈</span>
                    <span>2. Statistical Test Breakdown (p-values, Confidence Intervals & Effect Size)</span>
                  </h4>
                </div>

                {result.metrics && result.metrics.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">Test / Variable</th>
                          <th className="p-2.5">Statistic / p-value</th>
                          <th className="p-2.5">95% CI / Effect Size</th>
                          <th className="p-2.5">Scholarly & Burmese Meaning</th>
                          <th className="p-2.5 text-right">Verdict</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200 bg-slate-950/40">
                        {result.metrics.map((m, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold text-indigo-300">{m.metricName}</td>
                            <td className="p-2.5 font-mono text-cyan-300">{m.value}</td>
                            <td className="p-2.5 font-mono text-slate-300">
                              {[m.confidenceInterval, m.effectSize].filter(Boolean).join(' • ') || '-'}
                            </td>
                            <td className="p-2.5 text-slate-300 leading-relaxed">{m.interpretation}</td>
                            <td className="p-2.5 text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                                  m.isSignificant
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {m.isSignificant ? 'Significant' : 'Non-Significant'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                    ℹ️ <strong>Qualitative / Synthesis Notice:</strong> ဤစာတမ်းသည် Qualitative/Review အမျိုးအစားဖြစ်၍ သီးခြား p-value ကိန်းဂဏန်းများအစား သုတေသနအနှစ်ချုပ်ကို အောက်တွင် ဖော်ပြထားပါသည်။
                  </div>
                )}

                {/* Bilingual Explainer Switcher inside Part 2 */}
                <div className="pt-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-950 border border-slate-800">
                      <button
                        onClick={() => setActiveSubTab('burmese')}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                          activeSubTab === 'burmese'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        💡 မြန်မာလို အနှစ်ချုပ် (Plain Burmese)
                      </button>
                      <button
                        onClick={() => setActiveSubTab('english')}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                          activeSubTab === 'english'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        📝 Citation-Ready Paragraph (English)
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        const text =
                          activeSubTab === 'burmese'
                            ? result.plainBurmeseSummary
                            : result.academicEnglishParagraph;
                        navigator.clipboard.writeText(text);
                      }}
                      className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-all"
                    >
                      📋 Copy
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800/80 text-xs text-slate-200 leading-relaxed">
                    {activeSubTab === 'burmese' ? (
                      <p className="font-sans leading-loose text-slate-200">
                        {result.plainBurmeseSummary}
                      </p>
                    ) : (
                      <p className="italic font-serif leading-relaxed text-slate-200">
                        "{result.academicEnglishParagraph}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* PART 3: ⚠️ Methodological Limitations & Risk of Bias */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>3. Methodological Limitations & Risk of Bias (Actionable Citation Critique)</span>
                  </h4>
                  <button
                    onClick={() => {
                      const critiqueText = `Risk of Bias: ${result.riskOfBias || 'Moderate'}\nMethodological Limitations:\n${
                        result.limitationsList && result.limitationsList.length > 0
                          ? result.limitationsList.map((l) => `- ${l}`).join('\n')
                          : result.limitations
                      }`;
                      navigator.clipboard.writeText(critiqueText);
                    }}
                    className="px-2.5 py-1 text-[11px] rounded bg-amber-900/40 hover:bg-amber-800/50 text-amber-200 border border-amber-600/40 cursor-pointer transition-all"
                  >
                    📋 Copy Critique
                  </button>
                </div>

                {result.riskOfBias && (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-amber-500/20 text-xs text-amber-200 font-medium">
                    <strong className="text-amber-400">Risk of Bias Assessment:</strong> {result.riskOfBias}
                  </div>
                )}

                {result.limitationsList && result.limitationsList.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-200 pl-1">
                    {result.limitationsList.map((lim, lIdx) => (
                      <li key={lIdx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-amber-400 font-bold mt-0.5">•</span>
                        <span>{lim}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-200 leading-relaxed">{result.limitations}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs text-center p-6">
              <span className="text-2xl mb-2">📊</span>
              <span>အပေါ်မှ Link/PDF တင်သွင်းပါ သို့မဟုတ် ဘယ်ဘက်တွင် စာတမ်းအချက်အလက် ထည့်သွင်းပြီး ခလုတ်ကို နှိပ်ပါ</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
