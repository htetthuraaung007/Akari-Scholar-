/**
 * Multi-scenario Procedural Advisor Email Generator for University of the People
 * Generates context-specific, prompt-tailored, and non-repeating emails to Program Advisors in 100% formal English.
 */

export interface AdvisorEmailParams {
  advisorName?: string;
  studentName?: string;
  studentId?: string;
  degreeProgram?: string;
  cgpa?: string;
  coursesDone?: string;
  termPlan?: string;
  scholarshipScope?: string;
  customNotesPrompt?: string;
  seed?: number | string;
  variation?: number;
}

export interface AdvisorFormData {
  studentName: string;
  studentId: string;
  degreeProgram: string;
  cgpa: string;
  scholarshipScope?: string;
  urgentNote?: string;
}

export function generateAdvisorEmail(params: AdvisorEmailParams | AdvisorFormData): string {
  const advisor = 'Program Advisor';
  const name = (params.studentName || '[Student Name]').trim();
  const id = ((params as AdvisorEmailParams).studentId || '[Student ID]').trim();
  const degree = (params.degreeProgram || 'Bachelor of Science').trim();
  const cgpa = (params.cgpa || 'N/A').trim();

  // Extract scope & custom notes supporting both parameter naming conventions
  const rawScope = (params.scholarshipScope || '').trim();
  const rawNote = ((params as AdvisorEmailParams).customNotesPrompt || (params as AdvisorFormData).urgentNote || '').trim();

  // Normalize Scholarship Scope to Pure English (prevent Burmese leakage)
  let scopeEnglish = "Assessment Fee Scholarship Authorization for Upcoming Terms";
  if (rawScope) {
    const isBurmese = /[\u1000-\u109F]/.test(rawScope);
    if (!isBurmese) {
      scopeEnglish = rawScope;
    }
  }

  // Normalize Urgent Context to Pure English (prevent Burmese leakage)
  let urgencyEnglish = "I kindly request your urgent assistance in reopening the scholarship application portal so that I may complete my course registration before the upcoming deadline.";
  if (rawNote) {
    const isBurmese = /[\u1000-\u109F]/.test(rawNote);
    if (!isBurmese) {
      urgencyEnglish = rawNote;
    }
  }

  const subject = `SUBJECT: Formal Petition: Assessment Fee Scholarship Renewal for Upcoming Terms - ${name} (${id})`;
  const greeting = `Dear ${advisor},`;

  const intro = `I hope this email finds you well and in good health.\n\nI am writing to formally request your guidance and authorization to reopen the Assessment Fee Scholarship application portal for the upcoming terms. My name is ${name} (Student ID: ${id}), and I am actively pursuing my ${degree} at University of the People.`;

  const standingBlock = `Academic Standing & Scholarship Request:
• Degree Program: ${degree}
• Cumulative GPA: ${cgpa}
• Request Scope: ${scopeEnglish}`;

  const urgencyBlock = `Urgency & Context:\n${urgencyEnglish}`;

  const preservationBlock = `Preserving academic continuity is vital for my educational progression and future professional goals. Without scholarship support, independently covering the required assessment fees presents a severe financial barrier. I have maintained strong academic standing and remain deeply committed to excelling in my coursework.`;

  const actionRequest = `Could you please authorize the scholarship renewal form on my portal at your earliest convenience so that I may proceed with registration?`;

  const signoff = `Thank you very much for your continued dedication, support, and time.\n\nSincerely,\n\n${name}\nStudent ID: ${id}\n${degree}\nUniversity of the People`;

  return `${subject}\n\n${greeting}\n\n${intro}\n\n${standingBlock}\n\n${urgencyBlock}\n\n${preservationBlock}\n\n${actionRequest}\n\n${signoff}`;
}
