const DAILY_LIMIT = 5; // Enforce strict 5-times daily ceiling
const COOLDOWN_SECONDS = 0; // Do not stall submissions; rely on silent 2-layer model/key auto-cascade

export interface QuotaState {
  remainingToday: number;
  cooldownRemaining: number;
  canSend: boolean;
  message?: string;
}

export function checkAiQuota(featureKey: string = 'wellness'): QuotaState {
  if (typeof window === 'undefined') {
    return { remainingToday: DAILY_LIMIT, cooldownRemaining: 0, canSend: true };
  }

  const todayDateStr = new Date().toISOString().split('T')[0];

  // Check Daily Count
  const dailyTrackerKey = `akari_ai_daily_${featureKey}`;
  let storedDaily: { date?: string; count?: number } = {};
  try {
    storedDaily = JSON.parse(localStorage.getItem(dailyTrackerKey) || '{}');
  } catch {
    storedDaily = {};
  }

  let currentUsage = 0;
  if (storedDaily.date === todayDateStr) {
    currentUsage = storedDaily.count || 0;
  } else {
    // Reset counter on a new day
    localStorage.setItem(dailyTrackerKey, JSON.stringify({ date: todayDateStr, count: 0 }));
  }

  const remainingToday = Math.max(0, DAILY_LIMIT - currentUsage);

  if (remainingToday <= 0) {
    return {
      remainingToday: 0,
      cooldownRemaining: 0,
      canSend: false,
      message: 'သင့် Gemini API Key ၏ ယနေ့အတွက် သတ်မှတ်ထားသော အကြိမ်ရေ (၅ ကြိမ်) ပြည့်သွားပါပြီ။ မနက်ဖြန်တွင် ပြန်လည်အသုံးပြုနိုင်ပါသည်။',
    };
  }

  return {
    remainingToday,
    cooldownRemaining: COOLDOWN_SECONDS,
    canSend: true,
  };
}

export function recordAiUsage(featureKey: string = 'wellness'): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const todayDateStr = new Date().toISOString().split('T')[0];

  const lastSentKey = `akari_ai_last_sent_${featureKey}`;
  sessionStorage.setItem(lastSentKey, now.toString());
  localStorage.setItem(lastSentKey, now.toString());

  const dailyTrackerKey = `akari_ai_daily_${featureKey}`;
  let storedDaily: { date?: string; count?: number } = {};
  try {
    storedDaily = JSON.parse(localStorage.getItem(dailyTrackerKey) || '{}');
  } catch {
    storedDaily = {};
  }
  const count = (storedDaily.date === todayDateStr ? (storedDaily.count || 0) : 0) + 1;
  localStorage.setItem(dailyTrackerKey, JSON.stringify({ date: todayDateStr, count }));
}
