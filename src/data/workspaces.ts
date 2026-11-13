export interface WorkspaceCardItem {
  id: string;
  title: string;
  description: string;
  category: 'writing' | 'study' | 'wellness' | 'career';
  suiteLabel: string;
  suiteVariant: 'indigo' | 'emerald' | 'cyan' | 'purple' | 'amber' | 'pink';
  subTag: string;
  subTagVariant: 'blue' | 'emerald' | 'cyan' | 'purple' | 'slate' | 'pink' | 'amber';
  actionLabel: string;
  route: string;
  iconName: 'Sparkles' | 'Brain' | 'Scissors' | 'FileText' | 'BookOpen' | 'BarChart3' | 'Network' | 'Calendar' | 'Headphones' | 'Compass' | 'Target' | 'Award';
  isSpecial?: boolean;
}

export const WORKSPACE_CARDS: WorkspaceCardItem[] = [
  // --- WRITING SUITE (POSITIONS 1 TO 4) ---
  {
    id: 'assignment-stepper',
    title: 'Assignment Hub & 4-Step Stepper',
    description: 'Step 1 Rubric မှ Step 4 APA .docx အထိ အဆင့် ၄ ဆင့်ဖြင့် A အဆင့်ရရှိရန် စနစ်တကျ ရေးဆွဲခြင်း။',
    category: 'writing',
    suiteLabel: 'WRITING SUITE',
    suiteVariant: 'indigo',
    subTag: '4-STEP STEPPER',
    subTagVariant: 'purple',
    actionLabel: 'အဆင့်လိုက် စတင်မည် →',
    route: 'assignment',
    iconName: 'Sparkles'
  },
  {
    id: 'paraphraser-humanizer',
    title: 'Paraphrasing Depth Controller & Humanizer',
    description: 'Light Polish, Academic Elevation, Complete Rephrase အဆင့် ၃ ဆင့်ဖြင့် လူသားဟန် သဘာဝကျကျ မွမ်းမံပေးခြင်းနှင့် Citation Warning စစ်ဆေးခြင်း။',
    category: 'writing',
    suiteLabel: 'WRITING SUITE',
    suiteVariant: 'indigo',
    subTag: 'NATURAL TONE',
    subTagVariant: 'emerald',
    actionLabel: 'စာရေးဟန် ညှိမည် →',
    route: 'paraphraser',
    iconName: 'Brain'
  },

  {
    id: 'apa-word-exporter',
    title: 'APA 7th နှင့် Word (.docx) တိုက်ရိုက်ထုတ်ယူမှု',
    description: 'Assignment Activity အတွက် Title Page နှင့် References သီးခြားစာမျက်နှာပါသော Times New Roman 12pt Word ဖိုင် ထုတ်ယူခြင်း။',
    category: 'writing',
    suiteLabel: 'WRITING SUITE',
    suiteVariant: 'indigo',
    subTag: 'APA 7TH',
    subTagVariant: 'blue',
    actionLabel: 'Word ဖိုင် ထုတ်မည် →',
    route: 'apa',
    iconName: 'FileText'
  },

  // --- STUDY & RESEARCH (POSITIONS 5 TO 9 IN "ALL") ---
  {
    id: 'course-pdf-reader',
    title: 'Course PDF Reader (Distraction-Free)',
    description: 'Read heavy UoPeople & OpenStax textbooks offline by chapter. Strips heavy graphics for ultra-fast loading, minimal data, and focused reading.',
    category: 'study',
    suiteLabel: 'STUDY & RESEARCH',
    suiteVariant: 'emerald',
    subTag: 'DATA-SAVER READER',
    subTagVariant: 'blue',
    actionLabel: 'စာအုပ် ဖတ်မည် →',
    route: 'research',
    iconName: 'BookOpen'
  },
  {
    id: 'stats-explainer',
    title: 'သုတေသနစာတမ်း Q&A & Stats Explainer',
    description: 'PDF စာတမ်းများ ဖတ်ရှုစစ်ဆေးခြင်းနှင့် p-value, odds ratio စသည့် ကိန်းဂဏန်းများကို မြန်မာဘာသာဖြင့် ရှင်းပြချက် ရယူခြင်း။',
    category: 'study',
    suiteLabel: 'STUDY & RESEARCH',
    suiteVariant: 'emerald',
    subTag: 'STATS & PAPERS',
    subTagVariant: 'blue',
    actionLabel: 'သုတေသန စစ်မည် →',
    route: 'research',
    iconName: 'BarChart3'
  },
  {
    id: 'cross-unit-synthesis',
    title: 'Cross-Unit သီအိုရီ ချိတ်ဆက်မှု (Synthesis)',
    description: 'Unit 7 ရေးနေစဉ်တွင် Unit 2 သို့မဟုတ် Unit 4 မှ သီအိုရီများကို ပြန်လည် ချိတ်ဆက်ကိုးကား၍ အမှတ်တိုးစေခြင်း (Word ဖိုင် ထည့်သွင်းနိုင်သည်)။',
    category: 'study',
    suiteLabel: 'STUDY & RESEARCH',
    suiteVariant: 'emerald',
    subTag: 'SYNTHESIS LINKER',
    subTagVariant: 'purple',
    actionLabel: 'သီအိုရီ ချိတ်ဆက်မည် →',
    route: 'research',
    iconName: 'Network'
  },
  {
    id: 'bilingual-explainer',
    title: 'သင်ခန်းစာ ရှင်းလင်းချက် (EN + မြန်မာ)',
    description: 'သင်ခန်းစာ သို့မဟုတ် Slide များကို အင်္ဂလိပ်ရော မြန်မာဘာသာဖြင့်ပါ အသေးစိတ် ရှင်းလင်းချက်နှင့် Flashcard တိုက်ရိုက်ထုတ်ခြင်း။',
    category: 'study',
    suiteLabel: 'STUDY & RESEARCH',
    suiteVariant: 'emerald',
    subTag: 'BILINGUAL EXPLAINER',
    subTagVariant: 'emerald',
    actionLabel: 'ဖတ်ရှုမည် →',
    route: 'lesson',
    iconName: 'BookOpen'
  },
  {
    id: 'sm2-flashcard-quiz',
    title: 'Flashcards & စာမေးပွဲ (SM-2 စနစ်)',
    description: 'SuperMemo SM-2 အယ်လ်ဂိုရီသမ်ဖြင့် မေ့လွယ်သော မေးခွန်းများကို ပြန်လည်မေးပေးပြီး ရေရှည် မှတ်မိစေခြင်း။',
    category: 'study',
    suiteLabel: 'STUDY & RESEARCH',
    suiteVariant: 'emerald',
    subTag: 'SM-2 MEMORY',
    subTagVariant: 'purple',
    actionLabel: 'စတင်ကျက်မှတ်မည် →',
    route: 'flashcards',
    iconName: 'Brain'
  },

  // --- PRODUCTIVITY & WELLNESS ---
  {
    id: 'uopeople-timetable',
    title: 'UoPeople အပတ်စဉ် စာလေ့လာမှု အချိန်ဇယား',
    description: 'ကြာသပတေးနေ့ မှ ဗုဒ္ဓဟူးနေ့အထိ ၇ ရက်တာ Academic task ခွဲဝေမှု၊ GMT-5 Dual Clocks နှင့် Submission Countdown။',
    category: 'wellness',
    suiteLabel: 'PRODUCTIVITY & WELLNESS',
    suiteVariant: 'cyan',
    subTag: 'TIMETABLE',
    subTagVariant: 'blue',
    actionLabel: 'အချိန်ဇယား ကြည့်မည် →',
    route: 'rhythm',
    iconName: 'Calendar'
  },
  {
    id: 'cgpa-forecaster',
    title: 'CGPA Forecaster & ရည်မှန်းချက်',
    description: 'ကျန်ရှိသော Credits များတွင် အနည်းဆုံး မည်သည့် Grade များ ရယူရမည်ကို သင်္ချာနည်းကျ ကြိုတင်တွက်ချက်ပေးခြင်း။',
    category: 'wellness',
    suiteLabel: 'PRODUCTIVITY & WELLNESS',
    suiteVariant: 'cyan',
    subTag: 'CGPA PLANNER',
    subTagVariant: 'emerald',
    actionLabel: 'CGPA တွက်မည် →',
    route: 'cgpa',
    iconName: 'Target'
  },
  {
    id: 'pomodoro-focus',
    title: 'Pomodoro Focus & Study Audio',
    description: 'YouTube Study Audio Studio မှ စိတ်အေးချမ်းစေမည့် တေးသံစဉ်များ၊ လွတ်လပ်စွာ ရှာဖွေနားဆင်နိုင်သော Background Music များနှင့်အတူ တွဲဖက်အသုံးပြုနိုင်သည့် Pomodoro အာရုံစူးစိုက်မှု Timer။',
    category: 'wellness',
    suiteLabel: 'PRODUCTIVITY & WELLNESS',
    suiteVariant: 'cyan',
    subTag: 'FOCUS AUDIO',
    subTagVariant: 'purple',
    actionLabel: 'အာရုံစူးစိုက်မည် →',
    route: 'pomodoro',
    iconName: 'Headphones'
  },
  {
    id: 'impostor-syndrome',
    title: 'Impostor Syndrome & စိတ်ဓာတ်ခွန်အား',
    description: 'အမှတ်နည်းသွားချိန် သို့မဟုတ် စာမလိုက်နိုင်တော့ဘူးဟု ခံစားရချိန်တွင် GPA ပြန်ဆွဲတင်နိုင်မည့် ၃ ဆင့်နှင့် စိတ်အေးချမ်းစေမည့် အကြံပြုချက်။',
    category: 'wellness',
    suiteLabel: 'PRODUCTIVITY & WELLNESS',
    suiteVariant: 'cyan',
    subTag: 'WELLNESS',
    subTagVariant: 'purple',
    actionLabel: 'ခွန်အားယူမည် →',
    route: 'pomodoro',
    iconName: 'Compass'
  },

  // --- CAREER & GOALS ---
  {
    id: 'uopeople-scholar',
    title: '🎓 UoPeople Scholar (အသစ် / သက်တမ်းတိုး / Advisor Email)',
    description: 'UoPeople အသစ်လျှောက်ထားသူ၊ သက်တမ်းတိုးသူများအတွက် စာလုံးရေ ၁,၀၀၀ အတိအကျ စနစ်၊ Program Advisor ဆီသို့ ခွင့်ပြုချက်တောင်း Email နှင့် စံနှုန်းစစ်ဆေးခြင်း။',
    category: 'career',
    suiteLabel: 'CAREER & GOALS',
    suiteVariant: 'pink',
    subTag: 'UoPEOPLE OFFICIAL',
    subTagVariant: 'pink',
    actionLabel: 'UoPeople Scholar စတင်မည် →',
    route: 'uopeople_scholar',
    iconName: 'Award',
    isSpecial: true
  },
  {
    id: 'scholarship-sop',
    title: 'STAR Story Arc & Scholarship SOP',
    description: 'STAR Method (Situation, Task, Action, Result) ဖြင့် နိုင်ငံတကာ ပညာသင်ဆု Essay များကို ဦးဆောင်မှု ပေါ်လွင်အောင် ဖွဲ့စည်းခြင်း။',
    category: 'career',
    suiteLabel: 'CAREER & GOALS',
    suiteVariant: 'pink',
    subTag: 'SCHOLARSHIP',
    subTagVariant: 'pink',
    actionLabel: 'Essay ပြင်ဆင်မည် →',
    route: 'scholarship_sop_studio',
    iconName: 'Award'
  }
];
