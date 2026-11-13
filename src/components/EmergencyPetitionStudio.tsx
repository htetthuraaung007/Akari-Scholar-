import React, { useState } from 'react';

interface PetitionFormData {
  category: string;
  courseCode: string;
  instructorName: string;
  studentName: string;
  studentId: string;
  emergencyDetails: string;
  proposedDate: string;
}

const EMERGENCY_CATEGORIES = [
  { id: 'power', label: '⚡ လျှပ်စစ်မီး အချိန်ကြာမြင့်စွာ ပြတ်တောက်ခြင်း (Power Outage)', reason: 'Severe rolling blackouts and power grid disruptions in the local municipal area' },
  { id: 'network', label: '📡 အင်တာနက်လိုင်း/ဆက်သွယ်ရေး ပြတ်တောက်ခြင်း (Connectivity Loss)', reason: 'Total telecommunication and local ISP infrastructure downtime' },
  { id: 'unrest', label: '🚨 ဒေသတွင်း အရေးပေါ် မလုံခြုံမှု အခြေအနေ (Local Emergency)', reason: 'Unforeseen regional instability and localized civil emergency circumstances' },
  { id: 'extension', label: '⏱️ Assignment ရက်တိုးပေးရန် တောင်းဆိုမှု (Short Extension)', reason: 'Need a brief 48-72 hour extension due to acute infrastructure hurdles' },
  { id: 'incomplete', label: '📑 Incomplete Grade (INC) လျှောက်ထားခြင်း', reason: 'Formal application for Incomplete (INC) grade due to prolonged systemic disruption' }
];

export const EmergencyPetitionStudio: React.FC = () => {
  const [formData, setFormData] = useState<PetitionFormData>({
    category: 'power',
    courseCode: 'POLS 1503-01',
    instructorName: 'Dr. Smith',
    studentName: 'Student Name',
    studentId: 's1234567',
    emergencyDetails: 'Prolonged power grid disruption and blackout exceeding 24 hours in our township.',
    proposedDate: 'Friday, 11:59 PM (within 48 hours of power restoration)'
  });

  const [loading, setLoading] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Instant High-Standard Academic Template (ZERO Token Cost)
  const generateLocalEmail = () => {
    const selectedCat = EMERGENCY_CATEGORIES.find(c => c.id === formData.category);
    const text = `Subject: Urgent Extension Request: ${formData.courseCode} - Local Civil & Infrastructure Emergency - ${formData.studentName} (${formData.studentId})

Dear Instructor ${formData.instructorName},

I hope this message finds you well.

I am writing to formally request a short extension on the upcoming course assignment for ${formData.courseCode}. I am currently residing in an area experiencing acute municipal infrastructure disruption (${selectedCat?.reason || 'unforeseen civil emergencies'}), including:
- Specific Condition: ${formData.emergencyDetails}

Due to this disruption, access to stable electricity and academic portal networks has been severely constrained. I am fully committed to my coursework and have prepared my drafts. I respectfully request an adjusted submission deadline until ${formData.proposedDate}.

I will submit my coursework immediately once the situation stabilizes. Thank you very much for your kind understanding and consideration of these exceptional domestic circumstances.

Sincerely,
${formData.studentName}
Student ID: ${formData.studentId}
University of the People`;
    setGeneratedEmail(text);
  };

  // Optional AI Polishing via Server Gemini Endpoint
  const handleGenerateWithAI = async () => {
    const apiKey = localStorage.getItem('akari_gemini_api_key_primary') || '';

    setLoading(true);
    try {
      const selectedCat = EMERGENCY_CATEGORIES.find(c => c.id === formData.category);
      const prompt = `Write an authentic, highly respectful formal email to a UoPeople Professor requesting an assignment deadline extension.
Reason: Domestic emergency in Myanmar (${selectedCat?.reason}).
Details: ${formData.emergencyDetails}
Student: ${formData.studentName} (${formData.studentId})
Course: ${formData.courseCode}
Instructor: ${formData.instructorName}
Proposed Date: ${formData.proposedDate}
Constraint: Keep it under 180 words, strictly formal academic tone, include Subject line.`;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey && apiKey.trim().length >= 10) {
        headers['x-gemini-key'] = apiKey.trim();
      }

      const response = await fetch('/api/academic/assist', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'direct_assist',
          payload: {
            prompt,
            maxOutputTokens: 350
          }
        })
      });

      if (!response.ok) {
        generateLocalEmail();
        return;
      }

      const data = await response.json();
      const aiText = typeof data.result === 'string' ? data.result : '';
      if (aiText && aiText.trim()) {
        setGeneratedEmail(aiText.trim());
      } else {
        generateLocalEmail();
      }
    } catch {
      generateLocalEmail();
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedEmail);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-3.5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-950/80 text-amber-400 border border-amber-800/40">
            <span>✉️</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100">
              ဆရာ/ဆရာမထံ အရေးပေါ်ခွင့်တိုင်စာနှင့် Deadline ရက်ရွှေ့ခွင့် လျှောက်လွှာ
            </h3>
            <p className="text-[11px] text-slate-400">
              ပြည်တွင်းအရေးပေါ်အခြေအနေ (မီးပျက်ခြင်း၊ လိုင်းပြတ်တောက်ခြင်း) ကြောင့် တရားဝင် Formal Email စာလွှာ အဆင်သင့်ထုတ်ယူရန်
            </p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 border border-slate-800">
          UoPeople Academic Petition Policy
        </span>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Form Inputs */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-300 block">အရေးပေါ် အခြေအနေ အမျိုးအစား ရွေးချယ်ပါ:</label>
          <div className="space-y-1.5">
            {EMERGENCY_CATEGORIES.map((cat) => (
              <label
                key={cat.id}
                className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer text-xs transition-all ${
                  formData.category === cat.id
                    ? 'bg-amber-950/40 border-amber-600/60 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="emergency_category"
                  checked={formData.category === cat.id}
                  onChange={() => setFormData({ ...formData, category: cat.id })}
                  className="mt-0.5 text-amber-600 focus:ring-0"
                />
                <span className="font-semibold">{cat.label}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] text-slate-400 font-bold">Course Code & Section:</label>
              <input
                type="text"
                value={formData.courseCode}
                onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
                className="w-full p-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold">ဆရာ/ဆရာမ အမည်:</label>
              <input
                type="text"
                value={formData.instructorName}
                onChange={(e) => setFormData({ ...formData, instructorName: e.target.value })}
                className="w-full p-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold">ကျောင်းသား အမည်:</label>
              <input
                type="text"
                value={formData.studentName}
                onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                className="w-full p-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold">Student ID:</label>
              <input
                type="text"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                className="w-full p-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold">ဖြစ်ပွားခဲ့သည့် အခြေအနေ အသေးစိတ်:</label>
            <textarea
              rows={2}
              value={formData.emergencyDetails}
              onChange={(e) => setFormData({ ...formData, emergencyDetails: e.target.value })}
              className="w-full p-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold">စာတင်လိုသည့် ရက်စွဲအသစ် (Proposed Date):</label>
            <input
              type="text"
              value={formData.proposedDate}
              onChange={(e) => setFormData({ ...formData, proposedDate: e.target.value })}
              className="w-full p-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={generateLocalEmail}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
            >
              📄 Template တိုက်ရိုက်ထုတ်မည် (Instant)
            </button>
            <button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={loading}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer"
            >
              {loading ? 'ရေးသားနေပါသည်...' : '✨ AI ဖြင့် စနစ်တကျ ရေးမည်'}
            </button>
          </div>
        </div>

        {/* Right Preview Output */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">ဆရာ/ဆရာမထံ ပေးပို့ရန် တရားဝင် EMAIL</span>
              {generatedEmail && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                >
                  {copySuccess ? '✓ ကူးယူပြီးပါပြီ' : '📋 Email ကူးယူမည်'}
                </button>
              )}
            </div>

            {generatedEmail ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap max-h-[460px] overflow-y-auto">
                {generatedEmail}
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
                <span>ဘယ်ဘက်တွင် အချက်အလက်များ ဖြည့်စွက်ပြီး ခလုတ်ကို နှိပ်ပါ</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * UoPeople ဆရာအများစုသည် ဒေသတွင်း မီးနှင့် အင်တာနက်ပြတ်တောက်မှု အခြေအနေများကို စာနာနားလည်ပေးလေ့ရှိပြီး တရားဝင် စောစီးစွာ ခွင့်တိုင်ကြားပါက ရက်ရွှေ့ခွင့် ပေးလေ့ရှိပါသည်။
          </p>
        </div>
      </div>
    </div>
  );
};
