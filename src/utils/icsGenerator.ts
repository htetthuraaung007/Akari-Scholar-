import { AcademicTerm } from './uopeopleCalendar';

function formatDateToIcsUtc(date: Date): string {
  // Convert date to UTC string format YYYYMMDDTHHmmssZ
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const mins = pad(date.getUTCMinutes());
  const secs = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${mins}${secs}Z`;
}

export function generateTermIcsContent(term: AcademicTerm): string {
  const events: string[] = [];
  const dtstamp = formatDateToIcsUtc(new Date());

  // Helper to add event
  const addEvent = (uid: string, summary: string, description: string, start: Date, end: Date, alarms: boolean = true) => {
    let alarmBlock = '';
    if (alarms) {
      alarmBlock = `
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder: ${summary} due soon!
TRIGGER:-P1D
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder: ${summary} due in 3 hours!
TRIGGER:-PT3H
END:VALARM`;
    }

    events.push(`
BEGIN:VEVENT
UID:${uid}@uopeople.academic.suite
DTSTAMP:${dtstamp}
DTSTART:${formatDateToIcsUtc(start)}
DTEND:${formatDateToIcsUtc(end)}
SUMMARY:${summary}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
URL:https://my.uopeople.edu
STATUS:CONFIRMED${alarmBlock}
END:VEVENT`.trim());
  };

  const termStartGmt5 = new Date(`${term.startDate}T00:05:00-05:00`);
  const termEndGmt5 = new Date(`${term.endDate}T23:55:00-05:00`);
  const examStartGmt5 = new Date(`${term.examStartDate}T00:05:00-05:00`);
  const examEndGmt5 = new Date(`${term.examEndDate}T23:55:00-05:00`);
  const gradesDate = new Date(`${term.gradesPublishedDate}T09:00:00-05:00`);

  // 1. Term Kick-off Event
  addEvent(
    `term-start-${term.termNumber}`,
    `🚀 ${term.name} Kick-off & Unit 1 Access`,
    `Official start of ${term.name} at University of the People.\\nLogin to Moodle: https://my.uopeople.edu\\nReview Unit 1 learning guides and discussion prompts.`,
    termStartGmt5,
    new Date(termStartGmt5.getTime() + 3600000)
  );

  // 2. Weekly Deadlines for Units 1 to 8 (and Unit 9 exam week)
  // Let's generate weekly Sunday Discussion and Wednesday Assignment deadlines
  let curr = new Date(termStartGmt5.getTime());
  // Find first Sunday
  while (curr.getDay() !== 0 && curr < termEndGmt5) {
    curr.setDate(curr.getDate() + 1);
  }

  let unitCounter = 1;
  while (curr <= termEndGmt5 && unitCounter <= 9) {
    // Sunday Discussion Deadline (23:55 GMT-5)
    const sunDeadline = new Date(curr);
    sunDeadline.setHours(23, 55, 0);
    if (sunDeadline >= termStartGmt5 && sunDeadline <= termEndGmt5) {
      addEvent(
        `t${term.termNumber}-u${unitCounter}-discussion`,
        `🚨 Unit ${unitCounter} Discussion Initial Post Due`,
        `Submit Unit ${unitCounter} Discussion Forum Initial Post (300-500 words) with APA 7th citations before 23:55 GMT-5.\\nPortal: https://my.uopeople.edu`,
        sunDeadline,
        new Date(sunDeadline.getTime() + 3600000)
      );
    }

    // Wednesday Assignment & Learning Journal Deadline (23:55 GMT-5, 3 days after Sunday)
    const wedDeadline = new Date(curr);
    wedDeadline.setDate(wedDeadline.getDate() + 3);
    wedDeadline.setHours(23, 55, 0);

    if (wedDeadline >= termStartGmt5 && wedDeadline <= termEndGmt5) {
      addEvent(
        `t${term.termNumber}-u${unitCounter}-assignment`,
        `🚨 Unit ${unitCounter} Final Assignments Due`,
        `Submit Written Assignment (.docx), Learning Journal, and complete Quizzes for Unit ${unitCounter} before 23:55 GMT-5.\\nEnsure peer assessments are completed.\\nPortal: https://my.uopeople.edu`,
        wedDeadline,
        new Date(wedDeadline.getTime() + 3600000)
      );
      unitCounter++;
    }

    // Advance to next Sunday
    curr.setDate(curr.getDate() + 7);
  }

  // 3. Final Exam Window
  addEvent(
    `term-${term.termNumber}-exams`,
    `📝 ${term.name} Final Exam Window`,
    `Final Exam period for ${term.name}. Ensure all proctored or final exams are submitted before the deadline.\\nPortal: https://my.uopeople.edu`,
    examStartGmt5,
    examEndGmt5
  );

  // 4. Grades Published Announcement
  addEvent(
    `term-${term.termNumber}-grades`,
    `🎓 ${term.name} Official Grades Published`,
    `Final grades for ${term.name} are published on the UoPeople student portal.\\nCheck your CGPA and grade transcripts: https://my.uopeople.edu`,
    gradesDate,
    new Date(gradesDate.getTime() + 3600000),
    false
  );

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Akari Scholar//UoPeople Academic Calendar 2026-2027//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${term.name} - UoPeople Schedule`,
    'X-WR-TIMEZONE:UTC',
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
  const text = encodeURIComponent(`${term.name} - UoPeople Academic Calendar`);
  const start = term.startDate.replace(/-/g, '');
  const end = term.endDate.replace(/-/g, '');
  const details = encodeURIComponent(`Official academic calendar for ${term.name} at University of the People. Portal: https://my.uopeople.edu`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
}
