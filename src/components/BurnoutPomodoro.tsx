import React, { useState, useEffect, useRef } from 'react';
import { useApp, PlaylistItem } from '../context/AppContext';
import { useStreak } from '../context/StreakContext';
import { translations } from '../translations';
import { playPomodoroBell } from '../utils/audio';
import { ambientAudio, RADIO_STATIONS } from '../utils/ambientAudio';
import {
  Flame,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Heart,
  Smile,
  AlertTriangle,
  CheckCircle2,
  Coffee,
  Volume2,
  VolumeX,
  CloudRain,
  Radio,
  Music,
  Headphones,
  Compass,
  ArrowRight,
  ShieldCheck,
  Send,
  Search,
  X,
  Lock,
  Eye,
  Brain,
  Activity,
  Droplets,
  Bed,
  BookOpen,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  ListMusic,
  PictureInPicture2,
  ChevronDown,
  ChevronUp,
  Timer,
  Loader2,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WellnessCoach } from './WellnessCoach';
import { StudyAudioStudio } from './StudyAudioStudio';
import {
  generateDailyRecoveryProtocol,
  buildClinicalFallbackProtocol,
  resolveDynamicModelCatalog,
  type DailyRecoveryProtocol,
} from '../services/geminiService';

const DAILY_ENERGY_STATE_KEY = 'daily_energy_check_state_v2';
const DAILY_RECOVERY_RESULT_KEY = 'daily_recovery_protocol_result_v2';

interface DailyEnergyCheckState {
  energyLevel: number;
  stressLevel: number;
  stage: 'optimal' | 'moderate' | 'fatigue' | 'critical';
  studyHours: number;
  sleepHours: number;
  deadlinePressure: 'low' | 'medium' | 'high';
  symptoms: string[];
  savedAt: string;
}

function isValidDynamicProtocol(val: unknown): val is DailyRecoveryProtocol {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Partial<DailyRecoveryProtocol>;
  return (
    typeof obj.overview === 'string' &&
    Array.isArray(obj.protocols) &&
    obj.protocols.length > 0 &&
    obj.protocols.every(
      (p) =>
        p &&
        typeof p.category === 'string' &&
        typeof p.badge === 'string' &&
        Array.isArray(p.steps)
    )
  );
}

function loadDailyEnergyCheckState(): DailyEnergyCheckState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_ENERGY_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyEnergyCheckState>;
    if (
      typeof parsed.studyHours === 'number' &&
      typeof parsed.sleepHours === 'number' &&
      Array.isArray(parsed.symptoms)
    ) {
      return parsed as DailyEnergyCheckState;
    }
  } catch {
    // Ignore malformed localStorage entries
  }
  return null;
}

function loadDailyRecoveryResult(): DailyRecoveryProtocol | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_RECOVERY_RESULT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isValidDynamicProtocol(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore malformed localStorage entries
  }
  return null;
}

function saveDailyEnergyCheckState(state: DailyEnergyCheckState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_ENERGY_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

function saveDailyRecoveryResult(protocol: DailyRecoveryProtocol): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_RECOVERY_RESULT_KEY, JSON.stringify(protocol));
  } catch {
    // Ignore storage quota errors
  }
}

type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

const MODE_DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

export const BurnoutPomodoro: React.FC = () => {
  const {
    language,
    burnoutLog,
    updateBurnout,
    callAcademicApi,
    youtubePlayer,
    playYouTubeTrack,
    togglePlayPauseYouTube,
    closeYouTubePlayer,
    toggleMinimizeYouTube,
    playNextYouTubeTrack,
    playPreviousYouTubeTrack,
    toggleRepeatMode,
  } = useApp();
  const t = translations[language];
  const { recordStudyActivity } = useStreak();

  // =========================================================================
  // OBJECTIVE CLINICAL ASSESSMENT INPUTS (Students cannot tamper with energy/stress directly)
  // Restored instantaneously from `daily_energy_check_state` across tab navigation
  // =========================================================================
  const initialSavedEnergy = useRef<DailyEnergyCheckState | null>(loadDailyEnergyCheckState());
  const initialSavedProtocol = useRef<DailyRecoveryProtocol | null>(loadDailyRecoveryResult());
  const pomodoroCardRef = useRef<HTMLDivElement | null>(null);

  const [studyHours, setStudyHours] = useState<number>(() => {
    if (initialSavedEnergy.current) return initialSavedEnergy.current.studyHours;
    return burnoutLog.lastUpdated && burnoutLog.studyHoursToday !== undefined
      ? burnoutLog.studyHoursToday
      : 0;
  });
  const [sleepHours, setSleepHours] = useState<number>(() => {
    if (initialSavedEnergy.current) return initialSavedEnergy.current.sleepHours;
    return burnoutLog.lastUpdated && burnoutLog.sleepHours !== undefined
      ? burnoutLog.sleepHours
      : 0;
  });
  const [deadlinePressure, setDeadlinePressure] = useState<'low' | 'medium' | 'high'>(() => {
    if (initialSavedEnergy.current) return initialSavedEnergy.current.deadlinePressure;
    return burnoutLog.deadlinePressure || 'low';
  });
  const [symptoms, setSymptoms] = useState<string[]>(() => {
    if (initialSavedEnergy.current) return initialSavedEnergy.current.symptoms;
    return burnoutLog.symptoms || [];
  });
  const [savedEnergySnapshot, setSavedEnergySnapshot] = useState<DailyEnergyCheckState | null>(
    () => initialSavedEnergy.current
  );
  const [savedRecoveryProtocol, setSavedRecoveryProtocol] =
    useState<DailyRecoveryProtocol | null>(() => initialSavedProtocol.current);
  const [isGeneratingProtocol, setIsGeneratingProtocol] = useState(false);
  const [isProtocolExpanded, setIsProtocolExpanded] = useState(true);
  const [checkinSaved, setCheckinSaved] = useState(false);

  // Silent dynamic model catalog warmup once on component mount (zero API spam on save)
  useEffect(() => {
    void resolveDynamicModelCatalog();
  }, []);

  // Toggle symptom checkboxes
  const toggleSymptom = (symptomId: string) => {
    setSymptoms((prev) =>
      prev.includes(symptomId) ? prev.filter((id) => id !== symptomId) : [...prev, symptomId]
    );
  };

  // =========================================================================
  // SCIENTIFIC FORMULA: READ-ONLY ENERGY & STRESS CALCULATION
  // Derived objectively from sleep debt, study duration, deadlines, & physical symptoms
  // =========================================================================
  const calculateMetrics = () => {
    const isFreshZeroState =
      studyHours === 0 &&
      sleepHours === 0 &&
      symptoms.length === 0 &&
      deadlinePressure === 'low' &&
      !savedEnergySnapshot;

    if (isFreshZeroState) {
      return {
        energy: 10.0,
        stress: 0.0,
        stage: 'optimal' as const,
        energyFactors: [] as string[],
        stressFactors: [] as string[],
      };
    }

    // 1. Energy Calculation (Base 10.0, deductions for biological debt)
    let calcEnergy = 10.0;
    const energyFactors: string[] = [];

    // Sleep deficit (only deduct when user enters a positive sleep duration < 8h)
    if (sleepHours === 0 || sleepHours >= 8) {
      // optimal sleep or unset baseline
    } else if (sleepHours >= 7) {
      calcEnergy -= 1.0;
      energyFactors.push(language === 'my' ? 'အိပ်ချိန် ၇ နာရီ (-1.0)' : 'Sleep 7h (-1.0)');
    } else if (sleepHours >= 6) {
      calcEnergy -= 2.5;
      energyFactors.push(language === 'my' ? 'အိပ်ချိန် မလောက်မှု ၆ နာရီ (-2.5)' : 'Mild Sleep Deficit 6h (-2.5)');
    } else if (sleepHours >= 5) {
      calcEnergy -= 4.0;
      energyFactors.push(language === 'my' ? 'အိပ်ရေးပျက်မှု ၅ နာရီ (-4.0)' : 'Moderate Sleep Deficit 5h (-4.0)');
    } else {
      calcEnergy -= 5.5;
      energyFactors.push(language === 'my' ? 'အိပ်ရေးအလွန်ပျက်မှု <၅ နာရီ (-5.5)' : 'Severe Sleep Deficit <5h (-5.5)');
    }

    // Study hours fatigue
    if (studyHours > 7) {
      calcEnergy -= 2.5;
      energyFactors.push(language === 'my' ? 'စာလေ့လာချိန် ၇ နာရီကျော် (-2.5)' : 'Prolonged Study >7h (-2.5)');
    } else if (studyHours > 4.5) {
      calcEnergy -= 1.5;
      energyFactors.push(language === 'my' ? 'စာလေ့လာချိန် ၅ နာရီ (-1.5)' : 'Study Fatigue 5h (-1.5)');
    } else if (studyHours > 2.5) {
      calcEnergy -= 0.5;
    }

    // Symptoms impact on energy
    if (symptoms.includes('eyeStrain')) {
      calcEnergy -= 1.0;
      energyFactors.push(language === 'my' ? 'မျက်စိညောင်းညာမှု (-1.0)' : 'Eye Strain (-1.0)');
    }
    if (symptoms.includes('brainFog')) {
      calcEnergy -= 1.5;
      energyFactors.push(language === 'my' ? 'ဦးနှောက်ထိုင်းမှိုင်းမှု (-1.5)' : 'Brain Fog (-1.5)');
    }
    if (symptoms.includes('prolongedStudy')) {
      calcEnergy -= 1.0;
      energyFactors.push(language === 'my' ? 'အနားမယူဘဲ ဆက်တိုက်စာလုပ်မှု (-1.0)' : 'Continuous Study (-1.0)');
    }
    if (symptoms.includes('dehydration')) {
      calcEnergy -= 1.0;
      energyFactors.push(language === 'my' ? 'ရေသောက်နည်းမှု (-1.0)' : 'Dehydration (-1.0)');
    }
    if (symptoms.includes('highCaffeine')) {
      calcEnergy -= 0.5;
      energyFactors.push(language === 'my' ? 'Caffeine Crash (-0.5)' : 'Caffeine Crash (-0.5)');
    }

    const finalEnergy = Math.max(1.0, Math.min(10.0, Math.round(calcEnergy * 10) / 10));

    // 2. Stress Calculation (Base 1.0, additions for workload & anxiety)
    let calcStress = 1.0;
    const stressFactors: string[] = [];

    // Deadline pressure
    if (deadlinePressure === 'high') {
      calcStress += 4.5;
      stressFactors.push(language === 'my' ? 'အရေးပေါ် Deadlines / Finals (+4.5)' : 'Urgent Deadlines / Finals (+4.5)');
    } else if (deadlinePressure === 'medium') {
      calcStress += 2.5;
      stressFactors.push(language === 'my' ? 'Written Assignment ဖိအား (+2.5)' : 'Assignment Due 24h (+2.5)');
    } else {
      calcStress += 0.8;
    }

    // Sleep deficit impact on stress
    if (sleepHours > 0 && sleepHours < 5) {
      calcStress += 2.5;
      stressFactors.push(language === 'my' ? 'အိပ်ရေးပျက် Cortisol မြင့်တက်မှု (+2.5)' : 'Sleep Debt Cortisol Surge (+2.5)');
    } else if (sleepHours > 0 && sleepHours < 6) {
      calcStress += 1.5;
      stressFactors.push(language === 'my' ? 'အိပ်ရေးမလောက်မှု (+1.5)' : 'Sleep Deficit (+1.5)');
    }

    // Study fatigue impact on stress
    if (studyHours > 6) {
      calcStress += 2.0;
      stressFactors.push(language === 'my' ? 'စာဖတ်ချိန် ဝန်ပိမှု (+2.0)' : 'Heavy Study Load (+2.0)');
    } else if (studyHours > 4) {
      calcStress += 1.0;
    }

    // Symptoms impact on stress
    if (symptoms.includes('deadlinePanic')) {
      calcStress += 2.5;
      stressFactors.push(language === 'my' ? 'အချိန်မလောက် စိုးရိမ်ရင်တုန်မှု (+2.5)' : 'Deadline Panic (+2.5)');
    }
    if (symptoms.includes('brainFog')) {
      calcStress += 1.5;
      stressFactors.push(language === 'my' ? 'အာရုံစိုက်မရမှု ဝန်ပိခြင်း (+1.5)' : 'Cognitive Overload (+1.5)');
    }
    if (symptoms.includes('highCaffeine')) {
      calcStress += 1.0;
      stressFactors.push(language === 'my' ? 'Caffeine Jitters (+1.0)' : 'Caffeine Jitters (+1.0)');
    }
    if (symptoms.includes('eyeStrain')) {
      calcStress += 0.8;
      stressFactors.push(language === 'my' ? 'ခေါင်းကိုက်မျက်စိညောင်းမှု (+0.8)' : 'Headache / Tension (+0.8)');
    }
    if (symptoms.includes('dehydration')) {
      calcStress += 0.5;
    }

    const finalStress = Math.max(1.0, Math.min(10.0, Math.round(calcStress * 10) / 10));

    // 3. Clinical Stage Classification
    let stage: 'optimal' | 'moderate' | 'fatigue' | 'critical' = 'moderate';
    if (finalEnergy >= 7.0 && finalStress <= 4.0) {
      stage = 'optimal';
    } else if (finalEnergy <= 3.0 || finalStress >= 8.5) {
      stage = 'critical';
    } else if (finalEnergy <= 4.8 || finalStress >= 7.0) {
      stage = 'fatigue';
    } else {
      stage = 'moderate';
    }

    return {
      energy: finalEnergy,
      stress: finalStress,
      stage,
      energyFactors,
      stressFactors,
    };
  };

  const calculated = calculateMetrics();

  const hasUnsavedChanges =
    !savedEnergySnapshot ||
    savedEnergySnapshot.studyHours !== studyHours ||
    savedEnergySnapshot.sleepHours !== sleepHours ||
    savedEnergySnapshot.deadlinePressure !== deadlinePressure ||
    JSON.stringify([...savedEnergySnapshot.symptoms].sort()) !==
      JSON.stringify([...symptoms].sort());

  const activeProtocol: DailyRecoveryProtocol =
    !hasUnsavedChanges && savedRecoveryProtocol
      ? savedRecoveryProtocol
      : buildClinicalFallbackProtocol({
          energyLevel: calculated.energy,
          stressLevel: calculated.stress,
          stage: calculated.stage,
          studyHours,
          sleepHours,
          deadlinePressure,
          symptoms,
          language,
        });

  const handleSaveCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();

    updateBurnout({
      energyLevel: calculated.energy,
      stressLevel: calculated.stress,
      studyHoursToday: studyHours,
      sleepHours: sleepHours,
      deadlinePressure,
      symptoms,
      calculatedStage: calculated.stage,
      lastUpdated: nowIso,
    });

    const nextSnapshot: DailyEnergyCheckState = {
      energyLevel: calculated.energy,
      stressLevel: calculated.stress,
      stage: calculated.stage,
      studyHours,
      sleepHours,
      deadlinePressure,
      symptoms: [...symptoms],
      savedAt: nowIso,
    };
    saveDailyEnergyCheckState(nextSnapshot);
    setSavedEnergySnapshot(nextSnapshot);

    setIsProtocolExpanded(true);
    setIsGeneratingProtocol(true);

    try {
      const protocol = await generateDailyRecoveryProtocol({
        energyLevel: calculated.energy,
        stressLevel: calculated.stress,
        stage: calculated.stage,
        studyHours,
        sleepHours,
        deadlinePressure,
        symptoms,
        language,
      });

      saveDailyRecoveryResult(protocol);
      setSavedRecoveryProtocol(protocol);
      setCheckinSaved(true);
      setTimeout(() => setCheckinSaved(false), 2500);
    } catch {
      const fallback = buildClinicalFallbackProtocol({
        energyLevel: calculated.energy,
        stressLevel: calculated.stress,
        stage: calculated.stage,
        studyHours,
        sleepHours,
        deadlinePressure,
        symptoms,
        language,
      });
      saveDailyRecoveryResult(fallback);
      setSavedRecoveryProtocol(fallback);
      setCheckinSaved(true);
      setTimeout(() => setCheckinSaved(false), 2500);
    } finally {
      setIsGeneratingProtocol(false);
    }
  };

  // =========================================================================
  // POMODORO TIMER STATE
  // =========================================================================
  const [timerMode, setTimerMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(MODE_DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);

  // Timer interval effect
  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      const isBreak = timerMode === 'focus';
      playPomodoroBell(isBreak);

      if (timerMode === 'focus') {
        setCompletedSessions((prev) => prev + 1);
        recordStudyActivity('pomodoro');
        confetti({ particleCount: 40, spread: 45 });
        setTimerMode('shortBreak');
        setTimeLeft(MODE_DURATIONS.shortBreak);
      } else {
        setTimerMode('focus');
        setTimeLeft(MODE_DURATIONS.focus);
      }
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, timerMode]);

  const switchMode = (mode: TimerMode) => {
    setIsRunning(false);
    setTimerMode(mode);
    setTimeLeft(MODE_DURATIONS[mode]);
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setTimeLeft(MODE_DURATIONS[timerMode]);
  };

  const startFiveMinMicroBreak = () => {
    setTimerMode('shortBreak');
    setTimeLeft(MODE_DURATIONS.shortBreak);
    setIsRunning(true);
    pomodoroCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // =========================================================================
  // DUAL-MODE AUDIO STUDIO: BACKGROUND-IMMUNE RADIO & YOUTUBE
  // =========================================================================
  const [audioStudioMode, setAudioStudioMode] = useState<'radio' | 'youtube'>('youtube');
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [rainActive, setRainActive] = useState(false);
  const [noiseActive, setNoiseActive] = useState(false);
  const [volume, setVolume] = useState(70);

  // Subscribe to ambientAudio engine changes
  useEffect(() => {
    const unsub = ambientAudio.subscribe((state) => {
      setActiveStationId(state.activeStationId);
      setIsRadioPlaying(state.isPlaying);
      setRainActive(state.rainActive);
      setNoiseActive(state.noiseActive);
    });
    return () => unsub();
  }, []);

  // Floating Player ဖွင့်/ပိတ် ထိန်းချုပ်မှု & Audio State
  const [showFloatingPiP, setShowFloatingPiP] = useState(false);
  const [isStreamingOnline, setIsStreamingOnline] = useState(true);
  const [usingOfflineFallback, setUsingOfflineFallback] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Silent & Safe Audio Stream Error Handler
  const handleAudioStreamError = (e: React.SyntheticEvent<HTMLAudioElement, Event> | Event) => {
    // Raw event { isTrusted: true } ကို console.warn သို့ တိုက်ရိုက်မပို့စေဘဲ silent fallback လုပ်ခြင်း
    const audioElement = e.currentTarget as HTMLAudioElement;
    
    if (audioElement) {
      // လက်ရှိ fail ဖြစ်သွားသော audio source ကို pause လုပ်ပြီး safely reset ချခြင်း
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();
    }

    // Debugger panel တွင် Warning မတက်စေဘဲ silent state ပြောင်းလဲခြင်း
    // (တကယ်လိုအပ်မှသာ silent fallback flag ကို state သို့ ပို့ပေးပါ)
    setIsStreamingOnline(false);
    setUsingOfflineFallback(true);
  };

  const handleTrackNext = () => {
    playNextYouTubeTrack();
  };

  const handleToggleStation = (stationId: string) => {
    // If YouTube is playing, close or pause it to avoid audio collision
    if (youtubePlayer.isPlaying) {
      togglePlayPauseYouTube();
    }
    ambientAudio.toggleStation(stationId);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    ambientAudio.setVolume(newVol / 100);
  };

  const toggleRain = async () => {
    if (rainActive) {
      ambientAudio.stopRain();
    } else {
      await ambientAudio.startRain(0.4);
    }
  };

  const toggleNoise = async () => {
    if (noiseActive) {
      ambientAudio.stopNoise();
    } else {
      await ambientAudio.startNoise(0.35);
    }
  };

  const playZenBell = async () => {
    await ambientAudio.playChime();
  };

  // YouTube In-App Music Search & Queue
  const [ytInput, setYtInput] = useState('');
  const [ytSearching, setYtSearching] = useState(false);
  const [ytSearchResults, setYtSearchResults] = useState<{ videoId: string; title: string }[]>([]);
  const [showPlaylistQueue, setShowPlaylistQueue] = useState(false);

  // Helper to filter out AI-generated music (Suno, Udio, AI Cover, etc.)
  const isAiSong = (name: string): boolean => {
    if (!name) return false;
    const aiPattern =
      /\b(ai\s*cover|ai\s*song|ai\s*music|ai\s*version|ai\s*vocal|ai\s*remix|ai\s*track|ai\s*voice|suno|udio|diffsinger|so-vits|rvc|voice\s*model|artificial\s*intelligence|generated\s*by\s*ai|ai\s*generated|ai\s*band)\b|(\(ai\))|(\[ai\])|(ai\s*သီချင်း)|(ai\s*ကာဗာ)/i;
    return aiPattern.test(name);
  };

  const CURATED_STUDY_TRACKS: PlaylistItem[] = [
    { videoId: 'YjohMzHkBqI', title: 'Studio Ghibli Relaxing Piano' },
    { videoId: 'U4t25OiyJys', title: 'Myanmar Instrumental' },
    { videoId: '4xDzrJKXOOY', title: 'Deep Focus Study Piano' },
    { videoId: 'fEvM-OUbaKs', title: 'Coffee Shop Chill Bossa Nova' },
    { videoId: 'mPZkdNFkNps', title: 'Gentle Rain & Night Chill' },
    { videoId: '4Tr0otuiQuU', title: 'Peaceful Classical Study Piano' },
    { videoId: '1fueZCTYkpA', title: 'Peaceful Japanese Study Cafe' },
  ];

  const handleSelectYtTrack = (id: string, title: string) => {
    ambientAudio.stopAll();
    playYouTubeTrack(id, title, CURATED_STUDY_TRACKS);
    setYtSearchResults([]);
  };

  const handleYtSearchOrPaste = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = ytInput.trim();
    if (!query) return;

    ambientAudio.stopAll();

    const urlMatch = query.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i
    );
    if (urlMatch && urlMatch[1]) {
      playYouTubeTrack(urlMatch[1], `YouTube Video (${urlMatch[1]})`);
      setYtSearchResults([]);
      return;
    }

    if (/^[a-zA-Z0-9_-]{11}$/.test(query)) {
      playYouTubeTrack(query, `Video (${query})`);
      setYtSearchResults([]);
      return;
    }

    const localFound = CURATED_STUDY_TRACKS.find((t) =>
      t.title.toLowerCase().includes(query.toLowerCase())
    );
    if (localFound) {
      playYouTubeTrack(localFound.videoId, localFound.title, CURATED_STUDY_TRACKS);
      setYtSearchResults([]);
      return;
    }

    setYtSearching(true);
    try {
      const res = await fetch('/api/youtube/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const text = await res.text();
      let data: any = null;
      try {
        if (text && !text.trim().startsWith('<')) {
          data = JSON.parse(text);
        }
      } catch {
        data = null;
      }
      if (data && data.videoId) {
        // Strict filter: Exclude any AI generated songs
        const cleanResults = (data.results || []).filter(
          (item: { videoId: string; title: string }) => !isAiSong(item.title)
        );

        const targetVid = cleanResults.length > 0 ? cleanResults[0].videoId : data.videoId;
        const targetTitle = cleanResults.length > 0 ? cleanResults[0].title : data.title || query;

        playYouTubeTrack(targetVid, targetTitle, cleanResults.length > 0 ? cleanResults : undefined);
        if (cleanResults.length > 1) {
          setYtSearchResults(cleanResults);
        } else {
          setYtSearchResults([]);
        }
      }
    } catch (err) {
      console.error('YouTube search error:', err);
      playYouTubeTrack('U4t25OiyJys', `Search: "${query}"`);
    } finally {
      setYtSearching(false);
    }
  };

  // Impostor Syndrome & Academic Anxiety Grounding handled via <WellnessCoach />

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = ((MODE_DURATIONS[timerMode] - timeLeft) / MODE_DURATIONS[timerMode]) * 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
          <Flame className="w-8 h-8 text-amber-400" />
          <span>{t.pomodoro.title}</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          {t.pomodoro.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* =========================================================================
            LEFT COLUMN: POMODORO TIMER + DUAL-MODE FOCUS AUDIO
           ========================================================================= */}
        <div
          ref={pomodoroCardRef}
          className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between items-center text-center shadow-xl space-y-6"
        >
          {/* Mode switch pills */}
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 gap-1">
            <button
              onClick={() => switchMode('focus')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                timerMode === 'focus'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.pomodoro.focusMode}
            </button>
            <button
              onClick={() => switchMode('shortBreak')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                timerMode === 'shortBreak'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.pomodoro.shortBreak}
            </button>
            <button
              onClick={() => switchMode('longBreak')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                timerMode === 'longBreak'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.pomodoro.longBreak}
            </button>
          </div>

          {/* Clock Display */}
          <div className="relative w-60 h-60 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="120"
                cy="120"
                r="104"
                className="stroke-slate-800"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="120"
                cy="120"
                r="104"
                className={`transition-all duration-500 ${
                  timerMode === 'focus'
                    ? 'stroke-amber-500'
                    : timerMode === 'shortBreak'
                    ? 'stroke-emerald-500'
                    : 'stroke-indigo-500'
                }`}
                strokeWidth="10"
                strokeDasharray="653.45"
                strokeDashoffset={653.45 - (653.45 * progressPercent) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            <div className="absolute flex flex-col items-center">
              <span className="text-5xl font-black text-white font-mono tracking-tight">
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">
                {timerMode === 'focus' ? 'Focus Interval' : 'Restorative Rest'}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all hover:scale-105 cursor-pointer ${
                isRunning
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : timerMode === 'focus'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
              }`}
            >
              {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              <span>{isRunning ? t.common.pause : t.common.start}</span>
            </button>

            <button
              onClick={handleResetTimer}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
              title={t.common.reset}
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center space-x-2">
            <Coffee className="w-4 h-4 text-amber-400" />
            <span>
              {language === 'my' ? 'ယနေ့ ပြီးမြောက်သော အာရုံစူးစိုက်ချိန်:' : 'Focus sessions completed today:'}{' '}
              <strong className="text-white">{completedSessions}</strong>
            </span>
          </div>

          {/* =========================================================================
              FOCUS AUDIO STUDIO: DUAL ENGINE (BACKGROUND-IMMUNE RADIO & YOUTUBE)
             ========================================================================= */}
          <div className="w-full pt-4 border-t border-slate-800 space-y-3.5 text-left">
            {/* Audio Element with Safe Silent Stream Error Handler */}
            <audio
              ref={audioRef}
              preload="none"
              onError={handleAudioStreamError}
              onEnded={handleTrackNext}
              playsInline
            />

            {/* Unified Study Audio Studio Portal Target (Master stream runs at Root in App.tsx) */}
            <div id="pomodoro-audio-portal" className="animate-in fade-in pt-1" />
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: CLINICAL BURNOUT & FATIGUE ASSESSMENT (READ-ONLY METRICS)
           ========================================================================= */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
            {/* Header & Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-red-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {language === 'my'
                    ? 'နေ့စဉ် စိတ်ပိုင်း/ရုပ်ပိုင်း စွမ်းအင် စစ်ဆေးခြင်း'
                    : 'Daily Energy & Burnout Diagnostic'}
                </h3>
              </div>

              {/* Status Badge */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center space-x-1 ${
                  calculated.stage === 'optimal'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : calculated.stage === 'moderate'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : calculated.stage === 'fatigue'
                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'
                }`}
              >
                {calculated.stage === 'optimal'
                  ? (language === 'my' ? '● Normal / Fresh' : '● Normal / Fresh')
                  : calculated.stage === 'moderate'
                  ? (language === 'my' ? '▲ Caution' : '▲ Caution')
                  : calculated.stage === 'fatigue'
                  ? (language === 'my' ? '▲ Overextended' : '▲ Overextended')
                  : (language === 'my' ? '⚠ High Risk' : '⚠ High Risk')}
              </span>
            </div>

            <form onSubmit={handleSaveCheckin} className="space-y-4">
              {/* =========================================================================
                  READ-ONLY METRIC 1: ENERGY LEVEL (LOCKED / CLINICALLY CALCULATED)
                 ========================================================================= */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-slate-200">
                      {t.pomodoro.energyLabel}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center space-x-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>{language === 'my' ? 'Read-Only (စနစ်မှတွက်ချက်သည်)' : 'Auto-Derived'}</span>
                    </span>
                  </div>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {calculated.energy.toFixed(1)} / 10
                  </span>
                </div>

                {/* Visual Progress Gauge (User cannot drag) */}
                <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                    style={{ width: `${(calculated.energy / 10) * 100}%` }}
                  />
                </div>

                {/* Factors Chips */}
                {calculated.energyFactors.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {calculated.energyFactors.map((f, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* =========================================================================
                  READ-ONLY METRIC 2: STRESS LEVEL (LOCKED / CLINICALLY CALCULATED)
                 ========================================================================= */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-bold text-slate-200">
                      {t.pomodoro.stressLabel}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/10 text-red-300 border border-red-500/20 flex items-center space-x-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>{language === 'my' ? 'Read-Only (စနစ်မှတွက်ချက်သည်)' : 'Auto-Derived'}</span>
                    </span>
                  </div>
                  <span className="font-mono font-bold text-red-400 text-sm">
                    {calculated.stress.toFixed(1)} / 10
                  </span>
                </div>

                {/* Visual Progress Gauge (User cannot drag) */}
                <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
                    style={{ width: `${(calculated.stress / 10) * 100}%` }}
                  />
                </div>

                {/* Factors Chips */}
                {calculated.stressFactors.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {calculated.stressFactors.map((f, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* =========================================================================
                  OBJECTIVE INPUTS: STUDY HOURS & SLEEP HOURS
                 ========================================================================= */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center space-x-1">
                    <BookOpen className="w-3 h-3 text-indigo-400" />
                    <span>{t.pomodoro.studyHoursLabel}</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="18"
                    placeholder="0"
                    value={studyHours === 0 && !savedEnergySnapshot ? '' : studyHours}
                    onChange={(e) => setStudyHours(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center space-x-1">
                    <Bed className="w-3 h-3 text-cyan-400" />
                    <span>{t.pomodoro.sleepHoursLabel}</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="14"
                    placeholder="0"
                    value={sleepHours === 0 && !savedEnergySnapshot ? '' : sleepHours}
                    onChange={(e) => setSleepHours(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* =========================================================================
                  OBJECTIVE INPUT: DEADLINE PRESSURE / WORKLOAD
                 ========================================================================= */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-300">
                  {language === 'my'
                    ? 'လက်ရှိ Assignment / Exam Deadline ဖိအားအခြေအနေ:'
                    : 'Current Academic Deadline Intensity:'}
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDeadlinePressure('low')}
                    className={`py-1.5 px-2 rounded-xl text-center border font-medium transition-all cursor-pointer ${
                      deadlinePressure === 'low'
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🟢 {language === 'my' ? 'ပုံမှန်' : 'Normal'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeadlinePressure('medium')}
                    className={`py-1.5 px-2 rounded-xl text-center border font-medium transition-all cursor-pointer ${
                      deadlinePressure === 'medium'
                        ? 'bg-amber-950/70 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🟡 {language === 'my' ? '၂၄ နာရီအတွင်း' : 'Due <24h'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeadlinePressure('high')}
                    className={`py-1.5 px-2 rounded-xl text-center border font-medium transition-all cursor-pointer ${
                      deadlinePressure === 'high'
                        ? 'bg-red-950/70 border-red-500 text-red-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🔴 {language === 'my' ? 'အရေးပေါ် Deadlines' : 'Urgent Finals'}
                  </button>
                </div>
              </div>

              {/* =========================================================================
                  OBJECTIVE INPUT: PHYSICAL & COGNITIVE SYMPTOMS CHECKLIST (6 ITEMS)
                 ========================================================================= */}
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-300">
                  {language === 'my'
                    ? 'လက်ရှိ ခံစားနေရသော ရုပ်ပိုင်း/စိတ်ပိုင်း လက္ခဏာများ (မှန်ရာရွေးချယ်ပါ):'
                    : 'Current Physical & Cognitive Fatigue Symptoms:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {[
                    { id: 'eyeStrain', labelMy: '👁️ မျက်စိညောင်းညာ/ခေါင်းကိုက်ခြင်း', labelEn: '👁️ Eye Strain / Headache' },
                    { id: 'brainFog', labelMy: '🧠 အာရုံစူးစိုက်မရ/စာမမှတ်မိခြင်း', labelEn: '🧠 Brain Fog / Mental Haze' },
                    { id: 'prolongedStudy', labelMy: '⏱️ ၃ နာရီဆက်တိုက် မနားဘဲစာလုပ်ခြင်း', labelEn: '⏱️ Continuous Study >3h' },
                    { id: 'deadlinePanic', labelMy: '😰 အချိန်မလောက်မှာ စိုးရိမ်ရင်တုန်ခြင်း', labelEn: '😰 Deadline Panic / Anxiety' },
                    { id: 'highCaffeine', labelMy: '☕ ကော်ဖီ/Energy Drink အလွန်အကျွံသောက်ခြင်း', labelEn: '☕ High Caffeine Jitters' },
                    { id: 'dehydration', labelMy: '💧 ရေသောက်နည်း/ထမင်းကျော်စားမိခြင်း', labelEn: '💧 Dehydration / Skipped Meal' },
                  ].map((sym) => {
                    const isChecked = symptoms.includes(sym.id);
                    return (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => toggleSymptom(sym.id)}
                        className={`p-2 rounded-xl text-left border flex items-center space-x-2 transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-rose-950/40 border-rose-500/60 text-rose-200 font-medium'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] shrink-0 ${
                            isChecked
                              ? 'bg-rose-600 border-rose-500 text-white'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isChecked && '✓'}
                        </span>
                        <span className="truncate">{language === 'my' ? sym.labelMy : sym.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save Action Row */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800/80">
                <div className="flex items-center space-x-2 text-[11px]">
                  {isGeneratingProtocol ? (
                    <span className="text-emerald-300 flex items-center space-x-1.5 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>
                        {language === 'my'
                          ? 'သင့်လက္ခဏာများအတွက် Recovery Protocol ပြင်ဆင်နေသည်...'
                          : 'Synthesizing personalized recovery protocol...'}
                      </span>
                    </span>
                  ) : hasUnsavedChanges ? (
                    <span className="text-amber-300/90 flex items-center space-x-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {language === 'my'
                          ? 'ပြင်ဆင်ထားသော အချက်အလက်အသစ်များ သိမ်းဆည်းရန် နှိပ်ပါ။'
                          : 'Unsaved diagnostic edits — save to update protocol.'}
                      </span>
                    </span>
                  ) : savedEnergySnapshot ? (
                    <span className="text-slate-400 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        {language === 'my'
                          ? `သိမ်းဆည်းပြီး (${new Date(savedEnergySnapshot.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                          : `Synced at ${new Date(savedEnergySnapshot.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      {language === 'my'
                        ? 'လက္ခဏာများ ရွေးချယ်ပြီး သိမ်းဆည်းပါ။'
                        : 'Select symptoms & save to generate your recovery protocol.'}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isGeneratingProtocol}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold shrink-0 cursor-pointer shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center space-x-1.5"
                >
                  {isGeneratingProtocol ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{language === 'my' ? 'ပြင်ဆင်နေသည်...' : 'Generating...'}</span>
                    </>
                  ) : checkinSaved ? (
                    <span className="text-white flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{language === 'my' ? 'သိမ်းဆည်းပြီး!' : 'Saved!'}</span>
                    </span>
                  ) : (
                    <span>{t.pomodoro.saveLog}</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* =========================================================================
              ACTIONABLE RECOVERY PROTOCOL PANEL (100% DYNAMIC SYMPTOM-TAILORED)
             ========================================================================= */}
          <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-xl overflow-hidden transition-all duration-300 animate-in fade-in">
            {/* Collapsible Header */}
            <button
              type="button"
              onClick={() => setIsProtocolExpanded((prev) => !prev)}
              className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 hover:from-emerald-950/80 transition-colors cursor-pointer"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    {language === 'my'
                      ? '🌱 သင့်အတွက် လက်တွေ့ အနားယူနည်း လမ်းညွှန် (Actionable Recovery Protocol)'
                      : '🌱 Actionable Recovery Protocol'}
                  </h4>
                </div>
                <p className="text-[11px] text-emerald-200/80 leading-relaxed line-clamp-2">
                  {activeProtocol.overview}
                </p>
              </div>
              <span className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700 shrink-0">
                {isProtocolExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </span>
            </button>

            {isProtocolExpanded && (
              <div className="px-4 pb-5 pt-3 sm:px-5 space-y-3 animate-in fade-in duration-200 border-t border-slate-800/80">
                {isGeneratingProtocol ? (
                  <div className="space-y-3 py-1" aria-busy="true" aria-label="Generating recovery protocol">
                    <div className="flex items-center space-x-2 text-xs text-emerald-300 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>
                        {language === 'my'
                          ? 'သင်ရွေးချယ်ထားသော လက္ခဏာများအတွက် AI Recovery Protocol ဖန်တီးနေပါသည်...'
                          : 'Generating personalized protocols for your selected symptoms...'}
                      </span>
                    </div>
                    {Array.from({ length: Math.max(1, Math.min(symptoms.length || 2, 3)) }).map((_, skIdx) => (
                      <div
                        key={skIdx}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 animate-pulse"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="h-3.5 w-48 rounded bg-slate-800" />
                          <div className="h-4 w-28 rounded bg-slate-800/90" />
                        </div>
                        <div className="h-3 w-full rounded bg-slate-800/70" />
                        <div className="h-3 w-5/6 rounded bg-slate-800/60" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {activeProtocol.protocols.map((item, cardIdx) => {
                      const palette =
                        cardIdx % 3 === 0
                          ? {
                              border: 'border-emerald-500/25',
                              title: 'text-emerald-400',
                              badge: 'text-emerald-300/90 bg-emerald-950/60 border-emerald-500/25',
                              num: 'text-emerald-400',
                            }
                          : cardIdx % 3 === 1
                          ? {
                              border: 'border-indigo-500/25',
                              title: 'text-indigo-400',
                              badge: 'text-indigo-300/90 bg-indigo-950/60 border-indigo-500/25',
                              num: 'text-indigo-400',
                            }
                          : {
                              border: 'border-amber-500/25',
                              title: 'text-amber-400',
                              badge: 'text-amber-300/90 bg-amber-950/60 border-amber-500/25',
                              num: 'text-amber-400',
                            };

                      return (
                        <div
                          key={`${item.category}-${cardIdx}`}
                          className={`p-3.5 rounded-xl bg-slate-950 border ${palette.border} space-y-1.5`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`text-xs font-bold ${palette.title}`}>
                              {item.category}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-semibold border px-2 py-0.5 rounded-md ${palette.badge}`}
                            >
                              {item.badge}
                            </span>
                          </div>
                          <ul className="space-y-1 text-xs text-slate-300 leading-relaxed">
                            {item.steps.map((step, stepIdx) => (
                              <li key={stepIdx} className="flex items-start space-x-2">
                                <span
                                  className={`${palette.num} font-mono font-bold text-[11px] mt-0.5`}
                                >
                                  {stepIdx + 1}.
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}

                    {/* Quick-Action 5-Min Micro-Break Trigger */}
                    <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-[10px] font-mono text-slate-400">
                        {savedEnergySnapshot && !hasUnsavedChanges
                          ? `Saved snapshot • Energy ${savedEnergySnapshot.energyLevel.toFixed(1)}/10 • Stress ${savedEnergySnapshot.stressLevel.toFixed(1)}/10`
                          : language === 'my'
                          ? 'Preview Mode — သိမ်းဆည်းပါက AI စိတ်ကြိုက် Protocol ထွက်ရှိပါမည်'
                          : 'Preview Mode — Save check-in to persist tailored AI protocol'}
                      </span>
                      <button
                        type="button"
                        onClick={startFiveMinMicroBreak}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 cursor-pointer transition-all hover:scale-[1.02] shrink-0"
                      >
                        <Timer className="w-4 h-4" />
                        <span>
                          {language === 'my'
                            ? '⏱️ ၅ မိနစ် အနားယူမည် (Start 5-min Micro-Break)'
                            : '⏱️ Start 5-min Micro-Break'}
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Impostor Syndrome & Academic Anxiety Grounding Assistant */}
      <WellnessCoach language={language} />

      {/* Header ရှိ PiP ခလုတ်နှိပ်မှသာ Floating Window ပြသစေခြင်း */}
      {showFloatingPiP && (
        <div className="fixed bottom-4 right-4 z-50 w-72 sm:w-80 p-4 rounded-2xl bg-slate-950/95 border border-indigo-500/50 shadow-2xl backdrop-blur-md animate-in fade-in space-y-3 text-white">
          {/* Floating Player UI */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              <span className="text-xs font-bold truncate">
                {audioStudioMode === 'youtube' && youtubePlayer.isOpen
                  ? youtubePlayer.title
                  : activeStationId
                  ? (language === 'my' ? 'နောက်ခံ Focus Audio' : 'Background Audio')
                  : 'Study Audio Player'}
              </span>
            </div>
            <button 
              type="button"
              onClick={() => setShowFloatingPiP(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close PiP"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800 text-xs">
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={playPreviousYouTubeTrack}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                title="Previous"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (audioStudioMode === 'youtube') togglePlayPauseYouTube();
                  else if (activeStationId) handleToggleStation(activeStationId);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow cursor-pointer"
              >
                {youtubePlayer.isPlaying || isRadioPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={playNextYouTubeTrack}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                title="Next"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {usingOfflineFallback ? 'Offline Sync' : 'Active PiP'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
