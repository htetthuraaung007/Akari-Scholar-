export interface ChatbotContextPayload {
  activeTab: string;
  tabLabel: string;
  language: string;
  currentDraftText?: string;
  userEmail?: string;
  systemContextPrompt: string;
}

export function assembleChatbotContext(
  activeTab: string,
  language: 'my' | 'en',
  userEmail?: string,
  extraDraft?: string
): ChatbotContextPayload {
  let tabLabel = 'Dashboard';
  switch (activeTab) {
    case 'scholarship':
      tabLabel = 'UoPeople Scholarship & Advisor Petition';
      break;
    case 'rhythm':
      tabLabel = 'UoPeople Term Rhythm & Calendar';
      break;
    case 'cgpa':
      tabLabel = 'CGPA & Degree Planner';
      break;
    case 'assignment':
      tabLabel = 'Assignment Hub & AI Solver';
      break;
    case 'socratic':
      tabLabel = 'Socratic Peer Study Room';
      break;
    case 'research':
      tabLabel = 'Academic Research & DOI Hub';
      break;
    case 'apa':
      tabLabel = 'APA 7th Edition Citations Exporter';
      break;
    case 'lesson':
      tabLabel = 'Interactive Lesson Explainer & PDF';
      break;
    case 'flashcards':
      tabLabel = 'Spaced Repetition Flashcards';
      break;
    case 'career':
      tabLabel = 'Career Toolkit & ATS Resume';
      break;
    case 'pomodoro':
      tabLabel = 'Burnout & Study Pomodoro';
      break;
    case 'originality':
      tabLabel = 'Originality Checker & AI Bypass Studio';
      break;
    default:
      tabLabel = 'Main Dashboard';
  }

  const systemContextPrompt = `You are "Akari AI Academic Mentor", an expert senior academic advisor and AI prompt engineer specifically dedicated to University of the People (UoPeople) students.
Current Student Active Tab: ${tabLabel} (ID: ${activeTab})
Connected Gmail User: ${userEmail || 'Guest Student'}
Language Preference: ${language === 'my' ? 'Burmese (မြန်မာဘာသာ)' : 'English'}

Specializations:
1. UoPeople Scholarship application essays (Assessment Fee Waivers, P2P scholarships) & Program Advisor petitions.
2. Ethical APA 7th Edition academic citations and research structuring.
3. Anti-AI detection humanized writing guidance (ZeroGPT/GPTZero bypass tips).
4. CGPA management, course registration timelines, and academic counseling.

Always provide empathetic, precise, and actionable assistance. If drafted essay text is provided in the conversation, review it and offer concrete suggestions or direct Gmail drafts.`;

  return {
    activeTab,
    tabLabel,
    language,
    currentDraftText: extraDraft,
    userEmail,
    systemContextPrompt,
  };
}
