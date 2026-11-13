export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  streakFreezesRemaining: number; // default 1, max 2
  todayCompleted: boolean;
  weeklyActivityMap: boolean[]; // 7 days (Mon-Sun or Thu-Wed)
  freezeUsedTodayNotice?: string;
  unlockedMilestones: string[];
}

export const INITIAL_STREAK_STATE: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  streakFreezesRemaining: 1,
  todayCompleted: false,
  weeklyActivityMap: [false, false, false, false, false, false, false],
  unlockedMilestones: [],
};

const STREAK_STORAGE_KEY = 'akari_learning_streak_v1';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function loadStreakState(): StreakState {
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    if (!raw) return INITIAL_STREAK_STATE;
    const data = JSON.parse(raw);
    const today = getTodayDateString();

    // Check date continuity
    if (!data.lastActiveDate) return { ...INITIAL_STREAK_STATE, ...data };

    const lastDate = new Date(data.lastActiveDate);
    const currentDate = new Date(today);
    const diffTime = currentDate.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let updated = { ...INITIAL_STREAK_STATE, ...data };

    if (diffDays === 0) {
      // Same day, keep status
      updated.todayCompleted = data.todayCompleted || false;
    } else if (diffDays === 1) {
      // Consecutive day! Reset todayCompleted for the new day
      updated.todayCompleted = false;
      updated.freezeUsedTodayNotice = undefined;
    } else if (diffDays === 2 && updated.streakFreezesRemaining > 0) {
      // Missed 1 day, consume streak freeze!
      updated.streakFreezesRemaining -= 1;
      updated.todayCompleted = false;
      updated.freezeUsedTodayNotice = '🛡️ Streak Freeze အသုံးပြုပြီး စာလေ့လာမှု ရက်ဆက်ကို ကာကွယ်ပေးထားပါသည်!';
    } else {
      // Missed too many days, reset streak
      updated.currentStreak = 0;
      updated.todayCompleted = false;
      updated.freezeUsedTodayNotice = undefined;
    }

    return updated;
  } catch {
    return INITIAL_STREAK_STATE;
  }
}

export function saveStreakState(state: StreakState): void {
  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function recordActivity(toolName: 'pomodoro' | 'flashcards' | 'research'): { newState: StreakState; newlyUnlocked?: string } {
  const state = loadStreakState();
  const today = getTodayDateString();

  if (state.todayCompleted) {
    return { newState: state };
  }

  const isSameDay = state.lastActiveDate === today;
  let newStreak = state.currentStreak;

  if (!isSameDay) {
    if (!state.lastActiveDate) {
      newStreak = 1;
    } else {
      const lastDate = new Date(state.lastActiveDate);
      const currentDate = new Date(today);
      const diffDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays === 2 && state.streakFreezesRemaining > 0) {
        // Freeze saved streak!
        newStreak += 1;
      } else {
        newStreak = 1;
      }
    }
  } else {
    if (newStreak === 0) newStreak = 1;
  }

  const longest = Math.max(state.longestStreak, newStreak);
  const updatedWeekly = [...state.weeklyActivityMap];
  const dayIndex = new Date().getDay(); // 0 (Sun) to 6 (Sat)
  updatedWeekly[dayIndex] = true;

  // Check milestones
  let newlyUnlocked: string | undefined = undefined;
  const milestones = [...state.unlockedMilestones];
  const checkMilestone = (days: number, title: string) => {
    if (newStreak >= days && !milestones.includes(title)) {
      milestones.push(title);
      newlyUnlocked = title;
    }
  };

  checkMilestone(3, '🌱 Scholar Seedling (စတင်ပျိုးထောင်သူ)');
  checkMilestone(7, '🔥 Consistent Learner (အပတ်စဉ် အာရုံစိုက်သူ)');
  checkMilestone(14, '⚡ Unstoppable Momentum (ဇွဲမလျှော့သော ကျောင်းသား)');
  checkMilestone(30, '👑 Academic Master (ထူးချွန်စာသင်သား)');

  const newState: StreakState = {
    ...state,
    currentStreak: newStreak,
    longestStreak: longest,
    lastActiveDate: today,
    todayCompleted: true,
    weeklyActivityMap: updatedWeekly,
    unlockedMilestones: milestones,
  };

  saveStreakState(newState);
  return { newState, newlyUnlocked };
}
