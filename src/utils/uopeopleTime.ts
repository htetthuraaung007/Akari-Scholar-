/**
 * University of the People (UoPeople) Official Time & Device Local Time Utilities
 * Official Deadline Time: 11:25 PM UoPeople Time (GMT-5)
 * Local Device Time: Direct from device OS clock via Intl.DateTimeFormat().resolvedOptions().timeZone
 */

import { isCurrentlyTermBreak, resolveLiveAcademicContext } from './uopeopleCalendar';

export const UOPEOPLE_SUBMISSION_UPDATED_EVENT = 'akari_assignment_submission_updated';

export interface UoPeopleTimeStatus {
  uopFormattedTime: string;
  uopFormattedDate: string;
  localFormattedTime: string;
  localTimezone: string;
  nextDiscussionDeadline: Date;
  nextActivityDeadline: Date;
  discussionRemainingMs: number;
  activityRemainingMs: number;
  isTermBreak: boolean;
  activeWeekNumber: number;
  isCurrentWeekAssignmentSubmitted: boolean;
  activeDeadlineAlert: {
    type: 'discussion' | 'activity';
    title: string;
    alertBannerText: string;
    remainingHours: number;
    remainingMins: number;
    uopDeadlineStr: string;
    localDeadlineStr: string;
    isUrgent12h: boolean;
    deadlineKey: string;
    weekNumber: number;
  } | null;
}

// Convert a Date to UoPeople Time (GMT-5)
export function getUoPeopleDate(date: Date = new Date()): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc - 5 * 3600000);
}

// Format time in UoPeople GMT-5
export function formatUoPTime(date: Date = new Date()): string {
  try {
    return date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    const uop = getUoPeopleDate(date);
    return uop.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}

// Format local phone/device time
export function formatLocalDeviceTime(date: Date = new Date()): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Detect exact device timezone name (e.g. "Asia/Yangon", "Asia/Bangkok")
export function getLocalDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Resolve active UoPeople Unit / Week number (1 to 9)
export function getActiveAcademicWeekNumber(now: Date = new Date()): number {
  if (typeof window !== 'undefined') {
    try {
      const savedUnit = window.localStorage.getItem('uopeople_current_unit');
      if (savedUnit) {
        const parsed = JSON.parse(savedUnit);
        const num = Number(parsed);
        if (Number.isInteger(num) && num >= 1 && num <= 9) {
          return num;
        }
      }
    } catch {
      // Ignore parse error and fall back to date calculation
    }
  }

  const live = resolveLiveAcademicContext(now.toISOString().split('T')[0]);
  if (live.currentTerm) {
    const startMs = new Date(`${live.currentTerm.termStartDate}T00:00:00-05:00`).getTime();
    const diffDays = Math.floor((now.getTime() - startMs) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      return Math.min(9, Math.max(1, Math.floor(diffDays / 7) + 1));
    }
  }
  return 1;
}

// Standardized submission key: 'akari_assignment_submitted_wX'
export function getAssignmentSubmittedKey(weekNumber: number): string {
  const clamped = Math.min(9, Math.max(1, Math.round(weekNumber) || 1));
  return `akari_assignment_submitted_w${clamped}`;
}

// Check if assignment for week X is marked as submitted
export function isWeekAssignmentSubmitted(weekNumber: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = getAssignmentSubmittedKey(weekNumber);
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

// Calculate next upcoming Sunday 11:25 PM (23:25:00) in UoPeople Time (GMT-5)
export function getNextDiscussionDeadline(now: Date = new Date()): Date {
  const uopNow = getUoPeopleDate(now);
  const uopDay = uopNow.getDay(); // 0 is Sunday

  let daysUntilSunday = (7 - uopDay) % 7;
  if (
    daysUntilSunday === 0 &&
    (uopNow.getHours() > 23 || (uopNow.getHours() === 23 && uopNow.getMinutes() >= 25))
  ) {
    daysUntilSunday = 7;
  }

  const targetUopDate = new Date(uopNow);
  targetUopDate.setDate(uopNow.getDate() + daysUntilSunday);
  targetUopDate.setHours(23, 25, 0, 0);

  const offsetDiffMs = now.getTime() - uopNow.getTime();
  return new Date(targetUopDate.getTime() + offsetDiffMs);
}

// Calculate next upcoming Wednesday 11:25 PM (23:25:00) in UoPeople Time (GMT-5)
export function getNextActivityDeadline(now: Date = new Date()): Date {
  const uopNow = getUoPeopleDate(now);
  const uopDay = uopNow.getDay(); // 3 is Wednesday

  let daysUntilWed = (3 - uopDay + 7) % 7;
  if (
    daysUntilWed === 0 &&
    (uopNow.getHours() > 23 || (uopNow.getHours() === 23 && uopNow.getMinutes() >= 25))
  ) {
    daysUntilWed = 7;
  }

  const targetUopDate = new Date(uopNow);
  targetUopDate.setDate(uopNow.getDate() + daysUntilWed);
  targetUopDate.setHours(23, 25, 0, 0);

  const offsetDiffMs = now.getTime() - uopNow.getTime();
  return new Date(targetUopDate.getTime() + offsetDiffMs);
}

// Generate weekly deadline unique key e.g. "akari_assignment_submitted_w1"
export function getDeadlineUniqueKey(
  type: 'discussion' | 'activity',
  targetDate: Date,
  weekNum?: number
): string {
  if (type === 'activity') {
    const activeWeek = weekNum ?? getActiveAcademicWeekNumber();
    return getAssignmentSubmittedKey(activeWeek);
  }
  const year = targetDate.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (targetDate.getTime() - firstDayOfYear.getTime()) / 86400000;
  const isoWeek = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `uop_submitted_${type}_${year}_w${isoWeek}`;
}

export type UoPeopleTermMode = 'term_break' | 'active_term';

export function getUoPeopleTermMode(): UoPeopleTermMode {
  if (typeof window === 'undefined') return 'active_term';
  const saved = localStorage.getItem('uop_academic_term_mode');
  if (saved === 'term_break' || saved === 'active_term') {
    return saved;
  }
  return isCurrentlyTermBreak() ? 'term_break' : 'active_term';
}

export function setUoPeopleTermMode(mode: UoPeopleTermMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('uop_academic_term_mode', mode);
}

// Check if user confirmed submission for this deadline
export function isDeadlineSubmitted(deadlineKey: string, weekNumber?: number): boolean {
  if (typeof window === 'undefined') return false;
  if (weekNumber !== undefined && isWeekAssignmentSubmitted(weekNumber)) {
    return true;
  }
  const raw = localStorage.getItem(deadlineKey);
  return raw === 'true' || raw === 'confirmed';
}

// Permanently mark week's assignment as submitted and cancel/suppress remaining 24h/12h notifications
export function confirmDeadlineSubmission(deadlineKey: string, weekNumber?: number) {
  if (typeof window === 'undefined') return;
  const resolvedWeek = weekNumber ?? getActiveAcademicWeekNumber();
  const weekKey = getAssignmentSubmittedKey(resolvedWeek);

  try {
    localStorage.setItem(weekKey, 'true');
    if (deadlineKey) {
      localStorage.setItem(deadlineKey, 'true');
    }
    // Permanently suppress 24h and 12h notifications for this week
    localStorage.setItem(`akari_notified_24h_w${resolvedWeek}`, 'suppressed');
    localStorage.setItem(`akari_notified_12h_w${resolvedWeek}`, 'suppressed');
    window.dispatchEvent(
      new CustomEvent(UOPEOPLE_SUBMISSION_UPDATED_EVENT, {
        detail: { weekNumber: resolvedWeek, submitted: true },
      })
    );
  } catch (err) {
    console.warn('Failed to persist assignment submission confirmation:', err);
  }
}

/**
 * Triggers localized Web Notification API alert at 24h and 12h before the Wednesday 11:25 PM UoPeople deadline
 * if the week's assignment is not yet marked as submitted.
 */
export function maybeDispatchAssignmentBrowserNotification(
  weekNumber: number,
  remainingMs: number
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (isWeekAssignmentSubmitted(weekNumber)) return;

  const msIn24h = 24 * 3600000;
  const msIn12h = 12 * 3600000;

  if (remainingMs <= 0 || remainingMs > msIn24h) return;

  const is12hWindow = remainingMs <= msIn12h;
  const notifyKey = is12hWindow
    ? `akari_notified_12h_w${weekNumber}`
    : `akari_notified_24h_w${weekNumber}`;

  try {
    if (window.localStorage.getItem(notifyKey)) {
      return; // Already notified or suppressed for this threshold in week X
    }

    const message = is12hWindow
      ? '🚨 သတိပေးချက်: Assignment Activity တင်ရန် နောက်ဆုံးသတ်မှတ်ချိန် ၁၂ နာရီသာ လိုပါတော့သည်။'
      : '📢 သတိပေးချက်: Assignment Activity တင်ရန် ၂၄ နာရီသာ လိုပါတော့သည်။';

    if (Notification.permission === 'granted') {
      new Notification('UoPeople Assignment Activity Deadline', {
        body: message,
        tag: notifyKey,
      });
      window.localStorage.setItem(notifyKey, 'sent');
    }
  } catch {
    // Ignore browser notification permission errors
  }
}

/**
 * Requests Web Notification permission gracefully when user interacts with calendar notifications.
 */
export async function requestDeadlineNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// Compute full status and active reminder notification
export function getUoPeopleTimeStatus(explicitWeekNumber?: number): UoPeopleTimeStatus & { isTermBreak: boolean } {
  const now = new Date();
  const uopFormattedTime = formatUoPTime(now);
  const localFormattedTime = formatLocalDeviceTime(now);
  const localTimezone = getLocalDeviceTimezone();
  const isTermBreak = isCurrentlyTermBreak(now);
  const activeWeekNumber = explicitWeekNumber ?? getActiveAcademicWeekNumber(now);

  const discDeadline = getNextDiscussionDeadline(now);
  const actDeadline = getNextActivityDeadline(now);

  const discussionRemainingMs = Math.max(0, discDeadline.getTime() - now.getTime());
  const activityRemainingMs = Math.max(0, actDeadline.getTime() - now.getTime());

  const actKey = getAssignmentSubmittedKey(activeWeekNumber);
  const actSubmitted = isWeekAssignmentSubmitted(activeWeekNumber);

  let activeAlert: UoPeopleTimeStatus['activeDeadlineAlert'] = null;

  if (!isTermBreak) {
    const msIn24h = 24 * 3600000;
    const msIn12h = 12 * 3600000;

    // Check Assignment Activity deadline alert (<= 24h and unsubmitted)
    if (!actSubmitted && activityRemainingMs > 0 && activityRemainingMs <= msIn24h) {
      const totalMins = Math.floor(activityRemainingMs / 60000);
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const isUrgent12h = activityRemainingMs <= msIn12h;

      const alertBannerText = isUrgent12h
        ? '🚨 သတိပေးချက်: Assignment Activity တင်ရန် နောက်ဆုံးသတ်မှတ်ချိန် ၁၂ နာရီသာ လိုပါတော့သည်။'
        : '📢 သတိပေးချက်: Assignment Activity တင်ရန် ၂၄ နာရီသာ လိုပါတော့သည်။';

      maybeDispatchAssignmentBrowserNotification(activeWeekNumber, activityRemainingMs);

      activeAlert = {
        type: 'activity',
        title: 'Assignment Activity Deadline',
        alertBannerText,
        remainingHours: hours,
        remainingMins: mins,
        uopDeadlineStr: 'Wednesday 11:25 PM UoPeople Time (GMT-5)',
        localDeadlineStr: `${actDeadline.toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })} at ${formatLocalDeviceTime(actDeadline)}`,
        isUrgent12h,
        deadlineKey: actKey,
        weekNumber: activeWeekNumber,
      };
    }
  }

  return {
    uopFormattedTime,
    uopFormattedDate: getUoPeopleDate(now).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    localFormattedTime,
    localTimezone,
    isTermBreak,
    activeWeekNumber,
    isCurrentWeekAssignmentSubmitted: actSubmitted,
    nextDiscussionDeadline: discDeadline,
    nextActivityDeadline: actDeadline,
    discussionRemainingMs,
    activityRemainingMs,
    activeDeadlineAlert: activeAlert,
  };
}
