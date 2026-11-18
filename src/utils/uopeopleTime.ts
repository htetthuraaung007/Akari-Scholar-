/**
 * University of the People (UoPeople) Official Time & Device Local Time Utilities
 * Official Deadline Time: 11:55 PM (23:55 GMT-5)
 * Local Device Time: Strictly computed from UTC timestamps into the user's device OS timezone
 *                    without being skewed by VPN tunnels.
 */

import {
  getRegistrationPeriodContext,
  isCurrentlyTermBreak,
  RegistrationPeriodContext,
  resolveLiveAcademicContext,
} from './uopeopleCalendar';

export const UOPEOPLE_SUBMISSION_UPDATED_EVENT = 'akari_assignment_submission_updated';
export const UOPEOPLE_REG_ACK_UPDATED_EVENT = 'akari_registration_ack_updated';

export const THURSDAY_EXTENSION_NOTICE_MY =
  '⚠️ သတိပြုရန်: အချို့သော Course များတွင် Assignment Activity ကို Thursday 11:55 PM (UoPeople Time) အထိ ပေးထားတတ်သဖြင့် မိမိ Course ၏ Moodle/Syllabus တွင် ပြန်လည်စစ်ဆေးပါ။';

export const REGISTRATION_CLARIFICATION_NOTICE_MY =
  'ℹ️ Course Registration ကာလ စတင်ချိန်သည် ကျောင်းသားတစ်ယောက်ချင်းစီအလိုက် ကွဲပြားနိုင်သဖြင့် မိမိ၏ သတ်မှတ်ချိန် အတိအကျကို Student Portal (https://portal.uopeople.edu/login) တွင် ဝင်ရောက်စစ်ဆေးပါ။';

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
  registrationContext: RegistrationPeriodContext;
  isRegistrationAcknowledged: boolean;
  activeRegistrationAlert: {
    phase: '24h' | '12h' | 'open';
    message: string;
    targetTermKey: string;
    targetTermName: string;
  } | null;
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

/**
 * Computes a Date whose local getters represent UoPeople wall-clock (GMT-5) cleanly,
 * derived directly from UTC epoch without VPN/DST distortion.
 */
export function getUoPeopleDate(date: Date = new Date()): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc - 5 * 3600000);
}

/**
 * Returns pure UTC-5 wall-clock components directly from epoch milliseconds
 * so deadline math is 100% immune to device timezone changes or VPN routing.
 */
function getPureGmt5Components(date: Date = new Date()) {
  const shifted = new Date(date.getTime() - 5 * 3600000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    dayOfMonth: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(), // 0 = Sun, 3 = Wed
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

// Format time in UoPeople GMT-5 (fixed Etc/GMT+5 i.e. permanent UTC-5)
export function formatUoPTime(date: Date = new Date()): string {
  try {
    return date.toLocaleTimeString('en-US', {
      timeZone: 'Etc/GMT+5',
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

// Format time in UoPeople GMT-5 date label
export function formatUoPDate(date: Date = new Date()): string {
  try {
    return date.toLocaleDateString('en-US', {
      timeZone: 'Etc/GMT+5',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return getUoPeopleDate(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
}

// Format local phone/device time strictly in device OS timezone
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

// Standardized submission key: 'akari_submitted_unit_[X]'
export function getAssignmentSubmittedKey(unitNumber: number): string {
  const clamped = Math.min(9, Math.max(1, Math.round(unitNumber) || 1));
  return `akari_submitted_unit_${clamped}`;
}

// Check if assignment for unit X is marked as submitted
export function isWeekAssignmentSubmitted(unitNumber: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const clamped = Math.min(9, Math.max(1, Math.round(unitNumber) || 1));
    const unitKey = `akari_submitted_unit_${clamped}`;
    const legacyWeekKey = `akari_assignment_submitted_w${clamped}`;
    return (
      window.localStorage.getItem(unitKey) === 'true' ||
      window.localStorage.getItem(legacyWeekKey) === 'true'
    );
  } catch {
    return false;
  }
}

// Registration Period acknowledgment key per term
export function getRegistrationAckKey(targetTermKey: string): string {
  return `akari_reg_ack_${targetTermKey}`;
}

export function isRegistrationAcknowledged(targetTermKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(getRegistrationAckKey(targetTermKey)) === 'true';
  } catch {
    return false;
  }
}

export function confirmRegistrationAcknowledgment(targetTermKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getRegistrationAckKey(targetTermKey), 'true');
    window.localStorage.setItem(`akari_reg_notified_24h_${targetTermKey}`, 'suppressed');
    window.localStorage.setItem(`akari_reg_notified_12h_${targetTermKey}`, 'suppressed');
    window.localStorage.setItem(`akari_reg_notified_open_${targetTermKey}`, 'suppressed');
    window.dispatchEvent(
      new CustomEvent(UOPEOPLE_REG_ACK_UPDATED_EVENT, {
        detail: { targetTermKey, acknowledged: true },
      })
    );
  } catch (err) {
    console.warn('Failed to persist registration acknowledgment:', err);
  }
}

// Calculate next upcoming Sunday 11:55 PM (23:55:00 GMT-5) — Discussion Forum Deadline
export function getNextDiscussionDeadline(now: Date = new Date()): Date {
  const gmt5 = getPureGmt5Components(now);
  let daysUntilSunday = (7 - gmt5.dayOfWeek) % 7;
  if (
    daysUntilSunday === 0 &&
    (gmt5.hour > 23 || (gmt5.hour === 23 && gmt5.minute >= 55))
  ) {
    daysUntilSunday = 7;
  }

  // Exact UTC timestamp corresponding to 23:55:00 GMT-5 (+5h from GMT-5 = next day 04:55 UTC)
  const targetUtcMs =
    Date.UTC(gmt5.year, gmt5.month, gmt5.dayOfMonth + daysUntilSunday, 23, 55, 0, 0) +
    5 * 3600000;
  return new Date(targetUtcMs);
}

// Calculate next upcoming Wednesday 11:55 PM (23:55:00 GMT-5) — Assignment Activity Deadline
export function getNextActivityDeadline(now: Date = new Date()): Date {
  const gmt5 = getPureGmt5Components(now);
  let daysUntilWed = (3 - gmt5.dayOfWeek + 7) % 7;
  if (
    daysUntilWed === 0 &&
    (gmt5.hour > 23 || (gmt5.hour === 23 && gmt5.minute >= 55))
  ) {
    daysUntilWed = 7;
  }

  const targetUtcMs =
    Date.UTC(gmt5.year, gmt5.month, gmt5.dayOfMonth + daysUntilWed, 23, 55, 0, 0) +
    5 * 3600000;
  return new Date(targetUtcMs);
}

// Generate weekly deadline unique key e.g. "akari_submitted_unit_1"
export function getDeadlineUniqueKey(
  type: 'discussion' | 'activity',
  targetDate: Date,
  unitNum?: number
): string {
  if (type === 'activity') {
    const activeUnit = unitNum ?? getActiveAcademicWeekNumber();
    return getAssignmentSubmittedKey(activeUnit);
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
export function isDeadlineSubmitted(deadlineKey: string, unitNumber?: number): boolean {
  if (typeof window === 'undefined') return false;
  if (unitNumber !== undefined && isWeekAssignmentSubmitted(unitNumber)) {
    return true;
  }
  const raw = localStorage.getItem(deadlineKey);
  return raw === 'true' || raw === 'confirmed';
}

// Permanently mark unit's assignment as submitted and suppress remaining 24h/12h notifications
export function confirmDeadlineSubmission(deadlineKey: string, unitNumber?: number) {
  if (typeof window === 'undefined') return;
  const resolvedUnit = Math.min(9, Math.max(1, unitNumber ?? getActiveAcademicWeekNumber()));
  const unitKey = getAssignmentSubmittedKey(resolvedUnit);

  try {
    localStorage.setItem(unitKey, 'true');
    if (deadlineKey && deadlineKey !== unitKey) {
      localStorage.setItem(deadlineKey, 'true');
    }
    // Permanently suppress 24h and 12h notifications for this unit
    localStorage.setItem(`akari_notified_24h_w${resolvedUnit}`, 'suppressed');
    localStorage.setItem(`akari_notified_12h_w${resolvedUnit}`, 'suppressed');
    window.dispatchEvent(
      new CustomEvent(UOPEOPLE_SUBMISSION_UPDATED_EVENT, {
        detail: { weekNumber: resolvedUnit, submitted: true },
      })
    );
  } catch (err) {
    console.warn('Failed to persist assignment submission confirmation:', err);
  }
}

/**
 * Cross-platform Native OS Notification dispatcher:
 * Uses ServiceWorkerRegistration.showNotification when active (Android/iOS PWA),
 * and falls back cleanly to `new Notification(...)` on desktop Chrome/Edge/Safari/Mac/Windows.
 */
export function dispatchNativeOsNotification(
  title: string,
  body: string,
  tag: string
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      void navigator.serviceWorker.ready
        .then((registration) => {
          if (registration && typeof registration.showNotification === 'function') {
            return registration.showNotification(title, {
              body,
              tag,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
            });
          }
          new Notification(title, { body, tag });
          return undefined;
        })
        .catch(() => {
          new Notification(title, { body, tag });
        });
    } else {
      new Notification(title, { body, tag });
    }
  } catch {
    // Ignore restricted notification environments
  }
}

/**
 * Triggers native OS & Web Notification at 24h and 12h before the Wednesday 11:55 PM UoPeople deadline
 * if the unit's assignment is not yet marked as submitted (`akari_submitted_unit_[X]`).
 */
export function maybeDispatchAssignmentBrowserNotification(
  unitNumber: number,
  remainingMs: number
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (isWeekAssignmentSubmitted(unitNumber)) return;

  const msIn24h = 24 * 3600000;
  const msIn12h = 12 * 3600000;

  if (remainingMs <= 0 || remainingMs > msIn24h) return;

  const is12hWindow = remainingMs <= msIn12h;
  const notifyKey = is12hWindow
    ? `akari_notified_12h_w${unitNumber}`
    : `akari_notified_24h_w${unitNumber}`;

  try {
    if (window.localStorage.getItem(notifyKey)) {
      return; // Already notified or suppressed
    }

    const message = is12hWindow
      ? '🚨 သတိပြုရန်: Assignment Activity Deadline နီးကပ်နေပါပြီ (၁၂ နာရီသာ လိုပါတော့သည်)'
      : '⏰ Assignment Activity တင်ရန် ၂၄ နာရီသာ လိုပါတော့သည်';

    if (Notification.permission === 'granted') {
      dispatchNativeOsNotification('UoPeople Assignment Activity Deadline', message, notifyKey);
      window.localStorage.setItem(notifyKey, 'sent');
    }
  } catch {
    // Ignore browser notification permission errors
  }
}

/**
 * Triggers native OS & Web Notification for Course Registration milestones:
 * - 24h before open
 * - 12h before open
 * - On Open Day / active open window
 */
export function maybeDispatchRegistrationBrowserNotification(
  regContext: RegistrationPeriodContext
): {
  phase: '24h' | '12h' | 'open';
  message: string;
  targetTermKey: string;
  targetTermName: string;
} | null {
  if (isRegistrationAcknowledged(regContext.targetTermKey)) return null;

  const msIn24h = 24 * 3600000;
  const msIn12h = 12 * 3600000;

  let phase: '24h' | '12h' | 'open' | null = null;
  let message = '';
  let notifyKey = '';

  if (regContext.isOpenNow) {
    phase = 'open';
    message =
      '📢 Course Registration စတင်ဖွင့်လှစ်ပါပြီ။ Portal တွင် ဘာသာရပ်များ စာရင်းသွင်းနိုင်ပါပြီ။';
    notifyKey = `akari_reg_notified_open_${regContext.targetTermKey}`;
  } else if (
    regContext.isUpcoming &&
    regContext.remainingMs > 0 &&
    regContext.remainingMs <= msIn12h
  ) {
    phase = '12h';
    message = '🚨 သတိပြုရန်: Course Registration ဖွင့်ရန် ၁၂ နာရီသာ လိုပါတော့သည်။';
    notifyKey = `akari_reg_notified_12h_${regContext.targetTermKey}`;
  } else if (
    regContext.isUpcoming &&
    regContext.remainingMs > msIn12h &&
    regContext.remainingMs <= msIn24h
  ) {
    phase = '24h';
    message =
      '⏰ Course Registration ဖွင့်ရန် ၂၄ နာရီသာ လိုပါတော့သည်။ Portal တွင် မိမိ စတင်ချိန်ကို စစ်ဆေးထားပါ။';
    notifyKey = `akari_reg_notified_24h_${regContext.targetTermKey}`;
  }

  if (!phase) return null;

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (!window.localStorage.getItem(notifyKey) && Notification.permission === 'granted') {
        dispatchNativeOsNotification('UoPeople Course Registration', message, notifyKey);
        window.localStorage.setItem(notifyKey, 'sent');
      }
    } catch {
      // Ignore notification errors
    }
  }

  return {
    phase,
    message,
    targetTermKey: regContext.targetTermKey,
    targetTermName: regContext.targetTermName,
  };
}

/**
 * Requests Web Notification permission gracefully when user interacts with calendar notifications.
 */
export async function requestDeadlineNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
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

// Compute full status and active reminder notifications
export function getUoPeopleTimeStatus(
  explicitUnitNumber?: number
): UoPeopleTimeStatus & { isTermBreak: boolean } {
  const now = new Date();
  const uopFormattedTime = formatUoPTime(now);
  const uopFormattedDate = formatUoPDate(now);
  const localFormattedTime = formatLocalDeviceTime(now);
  const localTimezone = getLocalDeviceTimezone();
  const isTermBreak = isCurrentlyTermBreak(now);
  const activeWeekNumber = explicitUnitNumber ?? getActiveAcademicWeekNumber(now);

  const discDeadline = getNextDiscussionDeadline(now);
  const actDeadline = getNextActivityDeadline(now);

  const discussionRemainingMs = Math.max(0, discDeadline.getTime() - now.getTime());
  const activityRemainingMs = Math.max(0, actDeadline.getTime() - now.getTime());

  const actKey = getAssignmentSubmittedKey(activeWeekNumber);
  const actSubmitted = isWeekAssignmentSubmitted(activeWeekNumber);

  const registrationContext = getRegistrationPeriodContext(now);
  const regAcked = isRegistrationAcknowledged(registrationContext.targetTermKey);
  const activeRegistrationAlert = maybeDispatchRegistrationBrowserNotification(registrationContext);

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
        ? '🚨 သတိပြုရန်: Assignment Activity Deadline နီးကပ်နေပါပြီ (၁၂ နာရီသာ လိုပါတော့သည်)'
        : '⏰ Assignment Activity တင်ရန် ၂၄ နာရီသာ လိုပါတော့သည်';

      maybeDispatchAssignmentBrowserNotification(activeWeekNumber, activityRemainingMs);

      activeAlert = {
        type: 'activity',
        title: 'Assignment Activity Deadline',
        alertBannerText,
        remainingHours: hours,
        remainingMins: mins,
        uopDeadlineStr: 'Wednesday 11:55 PM (23:55 GMT-5)',
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
    uopFormattedDate,
    localFormattedTime,
    localTimezone,
    isTermBreak,
    activeWeekNumber,
    isCurrentWeekAssignmentSubmitted: actSubmitted,
    registrationContext,
    isRegistrationAcknowledged: regAcked,
    activeRegistrationAlert,
    nextDiscussionDeadline: discDeadline,
    nextActivityDeadline: actDeadline,
    discussionRemainingMs,
    activityRemainingMs,
    activeDeadlineAlert: activeAlert,
  };
}
