import { AcademicTerm } from './uopeopleCalendar';

function formatDateToIcsUtc(date: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const mins = pad(date.getUTCMinutes());
  const secs = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${mins}${secs}Z`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatInUserTimezone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Generates an RFC 5545 compliant VCALENDAR (.ics) string:
 * - Detects exact device timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
 * - Uses strict UTC `Z` format for DTSTAMP, DTSTART, DTEND so Google Calendar,
 *   Apple Calendar, and Outlook map timestamps automatically to the user's exact device timezone.
 * - Includes Registration Period (`UoPeople Course Registration Period Starts`),
 *   Late Registration Period, Drop Period (End of Week 1), Course Withdrawal Period (End of Week 4),
 *   Weekly Discussion & Assignment Activity Deadlines (11:55 PM / 23:55 GMT-5), and Final Exams.
 * - Embeds dual RFC 5545 VALARM components in critical events:
 *   1) TRIGGER:-P1D (Reminder: 24 hours remaining)
 *   2) TRIGGER:-PT12H (Urgent: 12 hours remaining)
 */
export function generateTermIcsContent(term: AcademicTerm): string {
  const userTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const events: string[] = [];
  const dtstamp = formatDateToIcsUtc(new Date());

  const addEvent = (
    uid: string,
    summary: string,
    description: string,
    start: Date,
    end: Date,
    url: string = 'https://my.uopeople.edu',
    includeAlarms: boolean = true
  ) => {
    const localizedStartStr = formatInUserTimezone(start, userTimeZone);
    const fullDescription = `${description}\nLocal Time (${userTimeZone}): ${localizedStartStr}`;

    const alarmBlock = includeAlarms
      ? [
          'BEGIN:VALARM',
          'TRIGGER:-P1D',
          'ACTION:DISPLAY',
          'DESCRIPTION:Reminder: 24 hours remaining',
          'END:VALARM',
          'BEGIN:VALARM',
          'TRIGGER:-PT12H',
          'ACTION:DISPLAY',
          'DESCRIPTION:Urgent: 12 hours remaining',
          'END:VALARM',
        ].join('\r\n')
      : '';

    const eventLines = [
      'BEGIN:VEVENT',
      `UID:${uid}@uopeople.academic.suite`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatDateToIcsUtc(start)}`,
      `DTEND:${formatDateToIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(fullDescription)}`,
      `URL:${url}`,
      'STATUS:CONFIRMED',
      ...(alarmBlock ? [alarmBlock] : []),
      'END:VEVENT',
    ];

    events.push(eventLines.join('\r\n'));
  };

  // Base timestamps in UoPeople Official Time (23:55 GMT-5)
  const termStartGmt5 = new Date(`${term.startDate}T00:05:00-05:00`);
  const termEndGmt5 = new Date(`${term.endDate}T23:55:00-05:00`);
  const examStartGmt5 = new Date(`${term.examStartDate}T00:05:00-05:00`);
  const examEndGmt5 = new Date(`${term.examEndDate}T23:55:00-05:00`);
  const gradesDate = new Date(`${term.gradesPublishedDate}T09:00:00-05:00`);

  // 1. Registration Period Starts Event (with exact requested Summary & Burmese description)
  const regStartGmt5 = term.registrationStartDate
    ? new Date(`${term.registrationStartDate}T00:00:00-05:00`)
    : new Date(termStartGmt5.getTime() - 42 * 24 * 3600000);
  const regEndGmt5 = term.registrationEndDate
    ? new Date(`${term.registrationEndDate}T23:55:00-05:00`)
    : new Date(termStartGmt5.getTime() - 15 * 24 * 3600000);

  addEvent(
    `term-${term.termNumber}-registration-period`,
    'UoPeople Course Registration Period Starts',
    'Course Registration ကာလ စတင်ပါပြီ။ Registration စတင်ချိန်သည် ကျောင်းသားတစ်ယောက်ချင်းစီအလိုက် ကွဲပြားနိုင်သဖြင့် မိမိ၏ သတ်မှတ်ချိန် အတိအကျကို Student Portal (https://portal.uopeople.edu/login) တွင် ဝင်ရောက်စစ်ဆေးပါ။',
    regStartGmt5,
    regEndGmt5,
    'https://portal.uopeople.edu/login',
    true
  );

  // 2. Late Registration Period
  const lateRegStartGmt5 = term.lateRegistrationStartDate
    ? new Date(`${term.lateRegistrationStartDate}T00:00:00-05:00`)
    : new Date(termStartGmt5.getTime() - 14 * 24 * 3600000);
  const lateRegEndGmt5 = term.lateRegistrationEndDate
    ? new Date(`${term.lateRegistrationEndDate}T23:55:00-05:00`)
    : new Date(termStartGmt5.getTime() - 8 * 24 * 3600000);

  addEvent(
    `term-${term.termNumber}-late-registration-period`,
    `⏳ ${term.name} Late Registration Period`,
    'Late Registration ကာလ ဖြစ်ပါသည်။ Registration စတင်ချိန်နှင့် အသေးစိတ်ကို ကျောင်းသားတစ်ယောက်ချင်းစီအလိုက် Student Portal (https://portal.uopeople.edu/login) တွင် ဝင်ရောက်စစ်ဆေးပါ။',
    lateRegStartGmt5,
    lateRegEndGmt5,
    'https://portal.uopeople.edu/login',
    true
  );

  // 3. Term Kick-off Event
  addEvent(
    `term-start-${term.termNumber}`,
    `🚀 ${term.name} Kick-off & Unit 1 Access`,
    `Official start of ${term.name} at University of the People.\nLogin to Moodle: https://my.uopeople.edu\nReview Unit 1 learning guides and syllabus grading breakdown.`,
    termStartGmt5,
    new Date(termStartGmt5.getTime() + 3600000),
    'https://my.uopeople.edu',
    true
  );

  // 4. Drop Period (End of Week 1 — Wednesday of Week 1 at 11:55 PM / 23:55 GMT-5)
  const week1EndWedGmt5 = new Date(`${term.startDate}T23:55:00-05:00`);
  week1EndWedGmt5.setUTCDate(week1EndWedGmt5.getUTCDate() + 6);
  addEvent(
    `term-${term.termNumber}-drop-period-week1`,
    `⚠️ ${term.name} Course Drop Period Deadline (End of Week 1)`,
    `Course Drop Period ends at the conclusion of Week 1 (Wednesday 11:55 PM / 23:55 GMT-5). Dropping a course during Week 1 leaves no W grade on your transcript.\nStudent Portal: https://portal.uopeople.edu/login`,
    new Date(week1EndWedGmt5.getTime() - 3600000),
    week1EndWedGmt5,
    'https://portal.uopeople.edu/login',
    true
  );

  // 5. Course Withdrawal Period (End of Week 4 — Wednesday of Week 4 at 11:55 PM / 23:55 GMT-5)
  const week4EndWedGmt5 = new Date(`${term.startDate}T23:55:00-05:00`);
  week4EndWedGmt5.setUTCDate(week4EndWedGmt5.getUTCDate() + 27);
  addEvent(
    `term-${term.termNumber}-withdrawal-period-week4`,
    `🛑 ${term.name} Course Withdrawal Period Deadline (End of Week 4)`,
    `Course Withdrawal Period ends at the conclusion of Week 4 (Wednesday 11:55 PM / 23:55 GMT-5). Withdrawing results in a 'W' on the transcript without impacting CGPA.\nStudent Portal: https://portal.uopeople.edu/login`,
    new Date(week4EndWedGmt5.getTime() - 3600000),
    week4EndWedGmt5,
    'https://portal.uopeople.edu/login',
    true
  );

  // 6. Weekly Deadlines for Units 1 to 8 (Sunday Discussion & Wednesday Assignment Activity at 11:55 PM / 23:55 GMT-5)
  for (let unit = 1; unit <= 8; unit++) {
    const unitOffsetDays = (unit - 1) * 7;

    // Sunday of Unit (3 days after Thursday start) at 11:55 PM (23:55 GMT-5)
    const sunDeadline = new Date(`${term.startDate}T23:55:00-05:00`);
    sunDeadline.setUTCDate(sunDeadline.getUTCDate() + unitOffsetDays + 3);

    if (sunDeadline <= termEndGmt5) {
      addEvent(
        `t${term.termNumber}-u${unit}-discussion`,
        `💬 Unit ${unit} Discussion Initial Post Due (11:55 PM / 23:55 GMT-5)`,
        `Submit Unit ${unit} Discussion Forum Initial Post with APA 7th citations before Sunday 11:55 PM (23:55 GMT-5).\nMoodle Portal: https://my.uopeople.edu`,
        new Date(sunDeadline.getTime() - 3600000),
        sunDeadline,
        'https://my.uopeople.edu',
        true
      );
    }

    // Wednesday of Unit (6 days after Thursday start) at 11:55 PM (23:55 GMT-5)
    const wedDeadline = new Date(`${term.startDate}T23:55:00-05:00`);
    wedDeadline.setUTCDate(wedDeadline.getUTCDate() + unitOffsetDays + 6);

    if (wedDeadline <= termEndGmt5) {
      addEvent(
        `t${term.termNumber}-u${unit}-assignment`,
        `🚨 Unit ${unit} Assignment Activity & Quizzes Due (11:55 PM / 23:55 GMT-5)`,
        `Submit Unit ${unit} Assignment Activity, Peer Assessments, and Quizzes before Wednesday 11:55 PM (23:55 GMT-5).\n⚠️ သတိပြုရန်: အချို့သော Course များတွင် Assignment Activity ကို Thursday 11:55 PM (UoPeople Time) အထိ ပေးထားတတ်သဖြင့် မိမိ Course ၏ Moodle/Syllabus တွင် ပြန်လည်စစ်ဆေးပါ။\nMoodle Portal: https://my.uopeople.edu`,
        new Date(wedDeadline.getTime() - 3600000),
        wedDeadline,
        'https://my.uopeople.edu',
        true
      );
    }
  }

  // 7. Final Exam Window (Unit 9)
  addEvent(
    `term-${term.termNumber}-exams`,
    `📝 ${term.name} Final Exam Window (Unit 9)`,
    `Final Exam period for ${term.name}. Complete all Final Exams before 11:55 PM (23:55 GMT-5).\nMoodle Portal: https://my.uopeople.edu`,
    examStartGmt5,
    examEndGmt5,
    'https://my.uopeople.edu',
    true
  );

  // 8. Official Grades Published
  addEvent(
    `term-${term.termNumber}-grades`,
    `🎓 ${term.name} Official Grades Published`,
    `Final grades for ${term.name} are published on the UoPeople Student Portal.\nCheck your CGPA and transcripts: https://portal.uopeople.edu/login`,
    gradesDate,
    new Date(gradesDate.getTime() + 3600000),
    'https://portal.uopeople.edu/login',
    false
  );

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Akari Scholar//UoPeople Academic Calendar 2026-2027//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`${term.name} - UoPeople Schedule`)}`,
    `X-WR-TIMEZONE:${userTimeZone}`,
    ...events,
    'END:VCALENDAR',
  ];

  return icsLines.join('\r\n');
}

export function downloadTermIcs(term: AcademicTerm) {
  const content = generateTermIcsContent(term);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `UoPeople_Academic_Calendar_Term_${term.termNumber}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getGoogleCalendarWebUrl(term: AcademicTerm): string {
  const userTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const text = encodeURIComponent(`${term.name} - UoPeople Academic Calendar`);
  const start = term.startDate.replace(/-/g, '');
  const end = term.endDate.replace(/-/g, '');
  const details = encodeURIComponent(
    `Official academic calendar for ${term.name} at University of the People (Deadlines: 11:55 PM / 23:55 GMT-5). Course Registration ကာလ စတင်ချိန်သည် ကျောင်းသားတစ်ယောက်ချင်းစီအလိုက် ကွဲပြားနိုင်သဖြင့် မိမိ၏ သတ်မှတ်ချိန် အတိအကျကို Student Portal (https://portal.uopeople.edu/login) တွင် ဝင်ရောက်စစ်ဆေးပါ။`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&ctz=${encodeURIComponent(userTimeZone)}&details=${details}`;
}
