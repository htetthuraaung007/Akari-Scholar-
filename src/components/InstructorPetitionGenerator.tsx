import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  Mail,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ZapOff,
  WifiOff,
  HeartPulse,
  Clock,
} from 'lucide-react';

export const InstructorPetitionGenerator: React.FC = () => {
  const { language, callAcademicApi } = useApp();

  const [reasonType, setReasonType] = useState<
    'power_outage' | 'internet_outage' | 'medical_emergency' | 'deadline_extension' | 'incomplete_grade'
  >('power_outage');

  const [courseCode, setCourseCode] = useState('POLS 1503-01');
  const [instructorName, setInstructorName] = useState('Dr. Smith');
  const [studentName, setStudentName] = useState('John Doe');
  const [studentId, setStudentId] = useState('s1234567');
  const [details, setDetails] = useState('Prolonged rolling blackout exceeding 24 hours in our township due to municipal grid failure.');
  const [proposedDate, setProposedDate] = useState('Friday, 11:59 PM (within 48 hours of power restoration)');

  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const REASONS = [
    {
      id: 'power_outage' as const,
      labelEn: 'Power Cut / Blackout',
      labelMy: 'လျှပ်စစ်မီးပျက်ခြင်း (Power Outage)',
      icon: ZapOff,
      defaultDetails: 'Severe prolonged electrical power outage in our district preventing computer operation and device charging.',
    },
    {
      id: 'internet_outage' as const,
      labelEn: 'Internet Disruption',
      labelMy: 'အင်တာနက်လိုင်းပြတ်တောက်ခြင်း (Network Disruption)',
      icon: WifiOff,
      defaultDetails: 'Widespread telecommunication fiber severance and regional mobile network blackout lasting over 18 hours.',
    },
    {
      id: 'medical_emergency' as const,
      labelEn: 'Medical Emergency',
      labelMy: 'ကျန်းမာရေးအရေးပေါ်အခြေအနေ (Illness/Hospitalization)',
      icon: HeartPulse,
      defaultDetails: 'Acute unexpected medical illness requiring medical attention and bed rest over the submission weekend.',
    },
    {
      id: 'deadline_extension' as const,
      labelEn: 'Assignment Extension Request',
      labelMy: 'Assignment ရက်တိုးပေးရန် တောင်းဆိုမှု (Extension)',
      icon: Clock,
      defaultDetails: 'Complex technical and family circumstances requiring a brief 48-hour extension to submit finalized activity.',
    },
    {
      id: 'incomplete_grade' as const,
      labelEn: 'Incomplete Grade (INC) Petition',
      labelMy: 'Incomplete Grade (INC) လျှောက်ထားခြင်း',
      icon: FileText,
      defaultDetails: 'Extenuating life circumstances occurring late in the term after successfully completing over 60% of coursework.',
    },
  ];

  const handleSelectReason = (reasonId: typeof reasonType) => {
    setReasonType(reasonId);
    const found = REASONS.find((r) => r.id === reasonId);
    if (found) {
      setDetails(found.defaultDetails);
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const selected = REASONS.find((r) => r.id === reasonType);
      const res = await callAcademicApi('extension_petition', {
        reasonType: selected ? selected.labelEn : 'Academic Petition',
        courseCode,
        instructorName,
        studentName,
        studentId,
        details,
        proposedDate,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate petition.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Description Banner */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-start space-x-3">
        <Mail className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-bold text-white flex items-center space-x-2">
            <span>
              {language === 'my'
                ? 'ဆရာ/ဆရာမထံ ခွင့်တိုင်စာနှင့် Deadline ရက်ရွှေ့ခွင့် လျှောက်လွှာ (Extension & Absence Petition)'
                : 'Instructor Excused Absence & Deadline Extension Petition Generator'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
              Formal UoPeople Academic Tone
            </span>
          </div>
          <p className="leading-relaxed text-slate-400">
            {language === 'my'
              ? 'မီးပျက်ခြင်း၊ အင်တာနက်ပြတ်တောက်ခြင်း သို့မဟုတ် ကျန်းမာရေးကိစ္စများကြောင့် Deadline မမီနိုင်ပါက ဆရာ/ဆရာမထံ ယဉ်ကျေးသိမ်မွေ့ပြီး တက္ကသိုလ်စည်းကမ်းနှင့် ကိုက်ညီသော တရားဝင် Email စာလွှာကို အသင့်ရေးသားပေးပါသည်'
              : 'Generate dignified, university-compliant petition emails for unexpected blackouts, telecommunication cuts, illness, or formal course extensions.'}
          </p>
        </div>
      </div>

      {/* Preset Reasons Chips */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          {language === 'my' ? 'အကြောင်းရင်း အမျိုးအစား ရွေးချယ်ပါ:' : 'Select Extenuating Circumstance:'}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {REASONS.map((r) => {
            const Icon = r.icon;
            const isSelected = reasonType === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectReason(r.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div className="font-bold text-[11px] leading-tight">
                  {language === 'my' ? r.labelMy : r.labelEn}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FORM INPUTS */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                {language === 'my' ? 'Course Code & Section:' : 'Course Code & Section:'}
              </label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. POLS 1503-01"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                {language === 'my' ? 'ဆရာ/ဆရာမ အမည်:' : 'Instructor Name:'}
              </label>
              <input
                type="text"
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="e.g. Dr. Robert Vance"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                {language === 'my' ? 'ကျောင်းသား အမည်:' : 'Student Name:'}
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Your Full Name"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                {language === 'my' ? 'UoPeople Student ID:' : 'Student ID:'}
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. s1234567"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              {language === 'my' ? 'ဖြစ်ပွားခဲ့သည့် အခြေအနေ အသေးစိတ်:' : 'Incident Specifics / Details:'}
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Explain the incident clearly..."
              className="w-full p-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              {language === 'my' ? 'စာတင်လိုသည့် ရက်စွဲအသစ် (Proposed Date):' : 'Proposed Submission Date:'}
            </label>
            <input
              type="text"
              value={proposedDate}
              onChange={(e) => setProposedDate(e.target.value)}
              placeholder="e.g. Friday 11:59 PM (within 48 hours)"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={handleGenerate}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {loading ? (
                <RotateCcw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-white" />
              )}
              <span>
                {loading
                  ? (language === 'my' ? 'ရေးသားနေသည်...' : 'Drafting Email...')
                  : (language === 'my' ? 'တရားဝင် ခွင့်တိုင်စာ ထုတ်ယူမည်' : 'Generate Petition Email')}
              </span>
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/30 p-3 rounded-xl border border-rose-500/30">
              {error}
            </p>
          )}
        </div>

        {/* OUTPUT EMAIL */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col h-full min-h-[460px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1.5">
              <Mail className="w-4 h-4" />
              <span>{language === 'my' ? 'ဆရာ/ဆရာမထံ ပေးပို့ရန် Email' : 'Ready-to-Send Petition'}</span>
            </span>

            {result && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Email</span>
                  </>
                )}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">
                {language === 'my'
                  ? 'တက္ကသိုလ် ဆရာ/ဆရာမထံ ပေးပို့ရန် ယဉ်ကျေးသိမ်မွေ့သော တရားဝင်စာ ရေးသားနေပါသည်...'
                  : 'Formatting formal university petition email...'}
              </p>
            </div>
          ) : result ? (
            <div className="flex-1 overflow-y-auto max-h-[520px] pr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {result}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <Mail className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
              <p className="text-xs max-w-sm">
                {language === 'my'
                  ? 'အချက်အလက်များကို ဘယ်ဘက်တွင် ဖြည့်ပြီး "တရားဝင် ခွင့်တိုင်စာ ထုတ်ယူမည်" ကို နှိပ်ပါ'
                  : 'Select reason and fill details to generate a formal academic petition for your professor.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
