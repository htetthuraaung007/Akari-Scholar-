import React, { useState, useEffect } from 'react';
import { runMultiImageOutlineAnalysis, MultiImageOutlineResult } from '../services/outlineGeminiService';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

export interface OutlineHistoryItem {
  id: string;
  timestamp: string;
  title: string;
  inputText: string;
  attachedFileStats: string | null;
  result: MultiImageOutlineResult;
}

interface UploadedImageItem {
  id: string;
  preview: string;
  base64: string;
  mimeType: string;
  fileName: string;
}

const OUTLINE_HISTORY_STORAGE_KEY = 'akari_outline_history_v1';

export interface AssignmentOutlineStudioProps {
  activeSharedRubric?: string;
  onRubricGenerated?: (rubric: string) => void;
}

export function formatRubricChecklistToText(checklist: any[]): string {
  if (!Array.isArray(checklist) || checklist.length === 0) return '';
  return checklist
    .map((item: any) => `• ${item.criterionTitle} (${item.weightOrPoints}): ${item.howToGetGradeA}`)
    .join('\n');
}

export const AssignmentOutlineStudio: React.FC<AssignmentOutlineStudioProps> = ({
  activeSharedRubric,
  onRubricGenerated
}) => {
  const [inputText, setInputText] = useState('');
  const [images, setImages] = useState<UploadedImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MultiImageOutlineResult | null>(null);
  const [attachedFileStats, setAttachedFileStats] = useState<string | null>(null);
  const [checkedCriteria, setCheckedCriteria] = useState<Record<number, boolean>>({});

  // History State
  const [history, setHistory] = useState<OutlineHistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Load History from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OUTLINE_HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to load outline history:', err);
    }
  }, []);

  const saveToHistory = (newResult: MultiImageOutlineResult, text: string, stats: string | null) => {
    try {
      const now = new Date();
      const timestampStr = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const titleSnippet = newResult.assignmentType || text.substring(0, 40) || 'Assignment Outline';

      const newItem: OutlineHistoryItem = {
        id: `outline_${Date.now()}`,
        timestamp: timestampStr,
        title: titleSnippet,
        inputText: text,
        attachedFileStats: stats,
        result: newResult
      };

      const updated = [newItem, ...history.filter(h => h.id !== newItem.id)].slice(0, 20);
      setHistory(updated);
      localStorage.setItem(OUTLINE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save outline to history:', err);
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem(OUTLINE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  };

  const clearAllHistory = () => {
    if (confirm('သိမ်းဆည်းထားသော အဟောင်းမှတ်တမ်းများ အားလုံးကို ဖျက်ပစ်ရန် သေချာပါသလား?')) {
      setHistory([]);
      localStorage.removeItem(OUTLINE_HISTORY_STORAGE_KEY);
    }
  };

  const loadHistoryItem = (item: OutlineHistoryItem) => {
    setResult(item.result);
    if (item.result.rubricChecklist) {
      localStorage.setItem('akari_active_rubric_checklist', JSON.stringify(item.result.rubricChecklist));
      const formatted = formatRubricChecklistToText(item.result.rubricChecklist);
      localStorage.setItem('akari_shared_rubric_text', formatted);
      if (onRubricGenerated) {
        onRubricGenerated(formatted);
      }
    }
    setInputText(item.inputText || '');
    setAttachedFileStats(item.attachedFileStats || null);
    setImages([]);
    setCheckedCriteria({});
    setShowHistoryModal(false);
  };

  // Client-Side Batch Image Compressor (Up to 12 images)
  const handleBatchImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > 12) {
      alert(`ပုံအများဆုံး ၁၂ ပုံသာ တင်နိုင်ပါသည်ခင်ဗျာ။ (လက်ရှိ: ${images.length} ပုံ၊ ထပ်ထည့်နိုင်သည့်အရေအတွက်: ${12 - images.length} ပုံ)`);
    }

    const availableSlots = 12 - images.length;
    const selectedFiles = files.slice(0, availableSlots);

    selectedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          const base64Data = dataUrl.split(',')[1];

          setImages((prev) => [
            ...prev,
            {
              id: `img-${Date.now()}-${Math.random()}`,
              preview: dataUrl,
              base64: base64Data,
              mimeType: 'image/jpeg',
              fileName: file.name
            }
          ]);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleClearAll = () => {
    setInputText('');
    setImages([]);
    setAttachedFileStats(null);
    setResult(null);
    setCheckedCriteria({});
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let extracted = '';

      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: arrayBuffer.slice(0) });
        extracted = res.value;
      } else if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        for (let i = 1; i <= Math.min(pdf.numPages, 12); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          extracted += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
      } else {
        extracted = await file.text();
      }

      const clean = extracted.trim();
      setInputText(clean);
      const words = clean ? clean.split(/\s+/).length : 0;
      setAttachedFileStats(`✓ ${file.name} | ${words.toLocaleString()} words loaded`);
    } catch {
      alert(`${file.name} ဖတ်ရှု၍ မရပါ။`);
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerateOutline = async () => {
    if (!inputText.trim() && images.length === 0) {
      alert('မေးခွန်းစာသား၊ Rubric ပုံ သို့မဟုတ် စာတမ်းဖိုင် တင်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    const apiKey = localStorage.getItem('akari_gemini_api_key_primary') || '';

    setLoading(true);
    try {
      const data = await runMultiImageOutlineAnalysis(
        inputText,
        images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
        apiKey
      );
      setResult(data);
      setCheckedCriteria({});
      if (data.rubricChecklist) {
        localStorage.setItem('akari_active_rubric_checklist', JSON.stringify(data.rubricChecklist));
        const formatted = formatRubricChecklistToText(data.rubricChecklist);
        localStorage.setItem('akari_shared_rubric_text', formatted);
        if (onRubricGenerated) {
          onRubricGenerated(formatted);
        }
      }
      saveToHistory(data, inputText, attachedFileStats);
    } catch (err: any) {
      alert(err.message || 'ခွဲခြမ်းစိတ်ဖြာရာတွင် အမှားအယွင်းရှိပါသည်');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Header with History Toggle */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📐</span>
          <span className="text-xs font-bold text-slate-100">A-Grade Assignment Outline & Rubric Studio (12-Image Multimodal)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <span>📜</span>
            <span>ယခင် မှတ်တမ်းများ ({history.length})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Input Area */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-200">
                ASSIGNMENT မေးခွန်း၊ RUBRIC သို့မဟုတ် လိုအပ်ချက်များ:
              </span>
              {(inputText || images.length > 0) && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  ✕ အကုန်ရှင်းမည်
                </button>
              )}
            </div>

            {/* Action Upload Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all">
                <span>🖼️</span>
                <span>ပုံ / Rubric တင်မည် ({images.length}/12)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBatchImageUpload}
                  disabled={images.length >= 12}
                  className="hidden"
                />
              </label>

              <label className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all">
                <span>📄</span>
                <span>Word / PDF တင်မည်</span>
                <input type="file" accept=".docx,.pdf,.txt" onChange={handleDocUpload} className="hidden" />
              </label>
            </div>

            {/* 12-Image Thumbnail Strip */}
            {images.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>တင်ထားသော ပုံများ ({images.length}/12 ပုံ အစီအစဉ်လိုက်):</span>
                  <button
                    type="button"
                    onClick={() => setImages([])}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                  >
                    ပုံအားလုံးဖျက်မည်
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 max-h-40 overflow-y-auto">
                  {images.map((img, idx) => (
                    <div key={img.id} className="relative group">
                      <img
                        src={img.preview}
                        alt={img.fileName}
                        className="w-full h-14 object-cover rounded-lg border border-slate-700"
                      />
                      <span className="absolute bottom-1 left-1 px-1 rounded text-[9px] font-bold bg-black/80 text-cyan-300 font-mono">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.id)}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center opacity-80 group-hover:opacity-100 shadow cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attachedFileStats && (
              <div className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg w-fit">
                {attachedFileStats}
              </div>
            )}

            <textarea
              rows={10}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Assignment မေးခွန်း သို့မဟုတ် ဖြည့်စွက်မှတ်စုများကို ဤနေရာတွင် ထည့်ပါ (သို့မဟုတ် အပေါ်မှ ပုံ ၁၂ ပုံအထိ တင်ပါ)..."
              className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <button
            onClick={handleGenerateOutline}
            disabled={loading || (!inputText.trim() && images.length === 0)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-all mt-2 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>ပုံ {images.length} ပုံအား အစီအစဉ်လိုက် ခွဲခြမ်းစိတ်ဖြာနေသည်...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>"A ရဖို့ ဘာတွေပါရမလဲ" Checklist & Outline ထုတ်မည်</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output Dashboard */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200">ခွဲခြမ်းစိတ်ဖြာချက် & A-GRADE OUTLINE ရလဒ်</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-cyan-400 border border-slate-800 font-semibold">
              A-Grade Rubric Compliant
            </span>
          </div>

          {result ? (
            <div className="space-y-4">
              {/* Top Directives */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Assignment Type</span>
                  <span className="text-xs font-bold text-indigo-300 block truncate mt-0.5">{result.assignmentType}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Target Length</span>
                  <span className="text-xs font-bold text-cyan-300 block truncate mt-0.5">{result.estimatedTargetWords}</span>
                </div>
                <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Rubric Criteria</span>
                  <span className="text-xs font-bold text-emerald-300 block truncate mt-0.5">{result.rubricChecklist?.length || 0} Items</span>
                </div>
              </div>

              {/* Core Question */}
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-700/30 text-xs">
                <span className="font-bold text-indigo-300 block mb-0.5">🎯 Core Question to Answer:</span>
                <p className="text-slate-200 leading-relaxed">{result.coreResearchQuestion}</p>
              </div>

              {/* 1. Rubric Checklist with Strike-through */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <span>📋</span> A-Grade Scoring Checklist (ပုံများမှ ဖတ်ယူထားသော စံနှုန်းများ)
                </h4>
                <div className="space-y-1.5">
                  {result.rubricChecklist?.map((item, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-800/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={!!checkedCriteria[idx]}
                        onChange={() => setCheckedCriteria((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                        className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <div className="text-xs flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold ${checkedCriteria[idx] ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {item.criterionTitle}
                          </span>
                          <span className="text-[10px] text-amber-400/90 font-mono">[{item.weightOrPoints}]</span>
                        </div>
                        <p className={`text-[11px] mt-0.5 ${checkedCriteria[idx] ? 'line-through text-slate-600' : 'text-slate-400'}`}>
                          {item.howToGetGradeA}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 2. Structured Sectional Outline */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <span>📐</span> High-Scoring Sectional Outline
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const text = result.structuredOutline
                        ?.map(
                          (s) =>
                            `### ${s.sectionTitle} (~${s.recommendedWordCount})\n- Rubric Target: ${s.rubricFocus}\n${s.keyPointsToCover?.map((k) => `  * ${k}`).join('\n')}`
                        )
                        .join('\n\n') || '';
                      navigator.clipboard.writeText(text);
                      alert('Outline copied to clipboard!');
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                  >
                    📋 Copy Outline
                  </button>
                </div>

                <div className="space-y-2">
                  {result.structuredOutline?.map((sec, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-indigo-300">{sec.sectionTitle}</h5>
                        <span className="text-[10px] font-mono text-slate-400">Target: {sec.recommendedWordCount}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        <strong className="text-slate-300">Rubric Target:</strong> {sec.rubricFocus}
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px] pt-1">
                        {sec.keyPointsToCover?.map((pt, pIdx) => (
                          <li key={pIdx}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evaluator Insight */}
              {result.insiderAdviceForMaxGrade && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-700/30 text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">💡</span>
                  <p><strong>Evaluator Insight:</strong> {result.insiderAdviceForMaxGrade}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
              <span>မေးခွန်း/Rubric ပုံများ (အများဆုံး ၁၂ ပုံ) သို့မဟုတ် ဖိုင်တင်သွင်းပြီး ခလုတ်ကို နှိပ်ပါ</span>
            </div>
          )}
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg p-5 rounded-2xl bg-[#0c1222] border border-slate-800 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">📜</span>
                <h3 className="text-sm font-bold text-slate-100">သိမ်းဆည်းထားသော အဟောင်း Outline မှတ်တမ်းများ</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {history.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  မှတ်တမ်းများ မရှိသေးပါခင်ဗျာ။ Outline ထုတ်ပြီးပါက ဤနေရာတွင် အလိုအလျောက် သိမ်းဆည်းပါမည်။
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadHistoryItem(item)}
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-indigo-600/60 cursor-pointer transition-all space-y-1 text-xs group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300 truncate max-w-[280px]">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-mono">{item.timestamp}</span>
                        <button
                          type="button"
                          onClick={(e) => deleteHistoryItem(item.id, e)}
                          className="text-slate-600 hover:text-rose-400 text-xs transition-colors p-1 cursor-pointer"
                          title="ဖျက်မည်"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {item.result.coreResearchQuestion}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">
                        {item.result.rubricChecklist?.length || 0} Criteria
                      </span>
                      {item.attachedFileStats && (
                        <span className="truncate max-w-[150px] text-emerald-400">{item.attachedFileStats}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {history.length > 0 && (
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                >
                  မှတ်တမ်းအားလုံး ဖျက်မည်
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="px-4 py-1.5 text-xs rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  ပိတ်မည်
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
