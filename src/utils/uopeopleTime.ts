/**
 * University of the People (UoPeople) Official Time & Device Local Time Utilities
 * Official Time: GMT-5 (Eastern Standard Time equivalent / America/New_York)
 * Local Device Time: Direct from device OS clock (independent of VPN IP tunnels)
 */

import { isCurrentlyTermBreak } from './uopeopleCalendar';

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
  activeDeadlineAlert: {
    type: 'discussion' | 'activity';
    title: string;
    remainingHours: number;
    remainingMins: number;
    uopDeadlineStr: string;
    localDeadlineStr: string;
    isUrgent12h: boolean;
    deadlineKey: string;
  } | null;
}

// Convert a Date to UoPeople Time string (GMT-5)
export function getUoPeopleDate(date: Date = new Date()): Date {
  // Format to UTC-5
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
    return uop.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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

// Get device timezone name (e.g. "Asia/Yangon", "Asia/Bangkok")
export function getLocalDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Device Time';
  } catch {
    return 'Device Time';
  }
}

// Calculate next upcoming Sunday 23:59:59 in UoPeople Time (Discussion Forum deadline)
export function getNextDiscussionDeadline(): Date {
  const now = new Date();
  // Find current day in UoPeople time
  const uopNow = getUoPeopleDate(now);
  const uopDay = uopNow.getDay(); // 0 is Sunday

  // Days until next Sunday
  let daysUntilSunday = (7 - uopDay) % 7;
  if (daysUntilSunday === 0 && (uopNow.getHours() === 23 && uopNow.getMinutes() === 59)) {
    daysUntilSunday = 7;
  }

  // Calculate target date in UTC
  const targetUopDate = new Date(uopNow);
  targetUopDate.setDate(uopNow.getDate() + daysUntilSunday);
  targetUopDate.setHours(23, 59, 59, 999);

  // Convert UoP target back to local equivalent timestamp
  const offsetDiffMs = (now.getTime() - uopNow.getTime());
  return new Date(targetUopDate.getTime() + offsetDiffMs);
}

// Calculate next upcoming Wednesday 23:59:59 in UoPeople Time (Assignment Activity deadline)
export function getNextActivityDeadline(): Date {
  const now = new Date();
  const uopNow = getUoPeopleDate(now);
  const uopDay = uopNow.getDay(); // 3 is Wednesday

  let daysUntilWed = (3 - uopDay + 7) % 7;
  if (daysUntilWed === 0 && (uopNow.getHours() === 23 && uopNow.getMinutes() === 59)) {
    daysUntilWed = 7;
  }

  const targetUopDate = new Date(uopNow);
  targetUopDate.setDate(uopNow.getDate() + daysUntilWed);
  targetUopDate.setHours(23, 59, 59, 999);

  const offsetDiffMs = (now.getTime() - uopNow.getTime());
  return new Date(targetUopDate.getTime() + offsetDiffMs);
}

// Generate weekly deadline unique key e.g. "uop_disc_2026_w45"
export function getDeadlineUniqueKey(type: 'discussion' | 'activity', targetDate: Date): string {
  const year = targetDate.getFullYear();
  // Approximate week number
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (targetDate.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `uop_submitted_${type}_${year}_w${weekNum}`;
}

// Term Mode state (Defaults to 'term_break' as requested: "အခုက term break ထားတာပါ။ term မစသေးပါဘူး။")
export type UoPeopleTermMode = 'term_break' | 'active_term';

export function getUoPeopleTermMode(): UoPeopleTermMode {
  if (typeof window === 'undefined') return 'term_break';
  const saved = localStorage.getItem('uop_academic_term_mode');
  return (saved === 'active_term' ? 'active_term' : 'term_break') as UoPeopleTermMode;
}

export function setUoPeopleTermMode(mode: UoPeopleTermMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('uop_academic_term_mode', mode);
}

// Check if user confirmed submission for this deadline
export function isDeadlineSubmitted(deadlineKey: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(deadlineKey) === 'confirmed';
}

// Mark deadline as submitted after 2-step confirmation
export function confirmDeadlineSubmission(deadlineKey: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(deadlineKey, 'confirmed');
}

// Compute full status and active reminder notification
export function getUoPeopleTimeStatus(): UoPeopleTimeStatus & { isTermBreak: boolean } {
  const now = new Date();
  const uopFormattedTime = formatUoPTime(now);
  const localFormattedTime = formatLocalDeviceTime(now);
  const localTimezone = getLocalDeviceTimezone();
  const isTermBreak = isCurrentlyTermBreak(now) || getUoPeopleTermMode() === 'term_break';

  const discDeadline = getNextDiscussionDeadline();
  const actDeadline = getNextActivityDeadline();

  const discussionRemainingMs = Math.max(0, discDeadline.getTime() - now.getTime());
  const activityRemainingMs = Math.max(0, actDeadline.getTime() - now.getTime());

  const discKey = getDeadlineUniqueKey('discussion', discDeadline);
  const actKey = getDeadlineUniqueKey('activity', actDeadline);

  const discSubmitted = isDeadlineSubmitted(discKey);
  const actSubmitted = isDeadlineSubmitted(actKey);

  let activeAlert: UoPeopleTimeStatus['activeDeadlineAlert'] = null;

  // When Term Break is active, do not trigger false assignment deadline alarms!
  if (!isTermBreak) {
    const msIn24h = 24 * 3600000;
    const msIn12h = 12 * 3600000;

    // Check Discussion Assignment deadline alert (<= 24h)
    if (!discSubmitted && discussionRemainingMs > 0 && discussionRemainingMs <= msIn24h) {
      const totalMins = Math.floor(discussionRemainingMs / 60000);
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      activeAlert = {
        type: 'discussion',
        title: 'Discussion Assignment Deadline',
        remainingHours: hours,
        remainingMins: mins,
        uopDeadlineStr: 'Sunday 11:59 PM (GMT-5)',
        localDeadlineStr: `${discDeadline.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${formatLocalDeviceTime(discDeadline)}`,
        isUrgent12h: discussionRemainingMs <= msIn12h,
        deadlineKey: discKey,
      };
    } else if (!actSubmitted && activityRemainingMs > 0 && activityRemainingMs <= msIn24h) {
      // Check Assignment Activity deadline alert (<= 24h)
      const totalMins = Math.floor(activityRemainingMs / 60000);
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      activeAlert = {
        type: 'activity',
        title: 'Assignment Activity Deadline',
        remainingHours: hours,
        remainingMins: mins,
        uopDeadlineStr: 'Wednesday 11:59 PM (GMT-5)',
        localDeadlineStr: `${actDeadline.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${formatLocalDeviceTime(actDeadline)}`,
        isUrgent12h: activityRemainingMs <= msIn12h,
        deadlineKey: actKey,
      };
    }
  }

  return {
    uopFormattedTime,
    uopFormattedDate: getUoPeopleDate(now).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    localFormattedTime,
    localTimezone,
    isTermBreak,
    nextDiscussionDeadline: discDeadline,
    nextActivityDeadline: actDeadline,
    discussionRemainingMs,
    activityRemainingMs,
    activeDeadlineAlert: activeAlert,
  };
}
