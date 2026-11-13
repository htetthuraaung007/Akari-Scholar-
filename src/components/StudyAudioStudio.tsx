import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface MusicTrack {
  id: string;
  title: string;
  youtubeId: string;
  playedAt?: string;
}

const STORAGE_KEY_QUEUE = 'akari_audio_queue';
const STORAGE_KEY_HISTORY = 'akari_audio_history';

const PRESET_YOUTUBE_TRACKS: MusicTrack[] = [
  { id: 'track_myanmar', title: 'Myanmar Instrumental', youtubeId: 'U4t25OiyJys' },
  { id: 'track_ghibli', title: 'Studio Ghibli Relaxing Piano', youtubeId: 'YjohMzHkBqI' },
  { id: 'track_deep_focus', title: 'Deep Focus Study Piano', youtubeId: '4xDzrJKXOOY' },
  { id: 'track_bossa', title: 'Coffee Shop Chill Bossa Nova', youtubeId: 'fEvM-OUbaKs' },
  { id: 'track_rain', title: 'Gentle Rain & Night Chill', youtubeId: 'mPZkdNFkNps' },
  { id: 'track_classical', title: 'Peaceful Classical Study Piano', youtubeId: '4Tr0otuiQuU' },
  { id: 'track_japan', title: 'Peaceful Japanese Study Cafe', youtubeId: '1fueZCTYkpA' }
];

interface StudyAudioStudioProps {
  onNavigateToPomodoroTab?: () => void;
  isInPomodoroWorkspace?: boolean;
}

type NavSourceMode = 'ask' | 'queue' | 'history';

export const BUILD_VER = 'v2.1-audio-fixed';

export const StudyAudioStudio: React.FC<StudyAudioStudioProps> = ({
  onNavigateToPomodoroTab,
  isInPomodoroWorkspace = true
}) => {
  useEffect(() => {
    console.info('[StudyAudioStudio] Build:', BUILD_VER);
  }, []);

  // Queue State: Initialized from localStorage ('akari_audio_queue') with strict [] zero-fallback
  const [queue, setQueue] = useState<MusicTrack[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_QUEUE);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);

  // History State: Initialized from localStorage ('akari_audio_history') with strict [] zero-fallback
  const [history, setHistory] = useState<MusicTrack[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(0);

  // Active Track & Strictly Stable Iframe Config
  // Do NOT mount or auto-play any video on startup (currentTrack = null, youtubeId = '', autoplay = 0)
  const [activeTrack, setActiveTrack] = useState<MusicTrack | null>(null);
  const [iframeConfig, setIframeConfig] = useState<{ youtubeId: string; autoplay: 0 | 1 }>({
    youtubeId: '',
    autoplay: 0
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);

  const [isRepeatOne, setIsRepeatOne] = useState<boolean>(false);
  const isRepeatOneRef = useRef<boolean>(false);

  // Next / Previous Navigation Source Mode ('ask' | 'queue' | 'history')
  const [navSourceMode, setNavSourceMode] = useState<NavSourceMode>('ask');
  const [pendingNavDirection, setPendingNavDirection] = useState<'prev' | 'next' | null>(null);
  const [rememberNavChoice, setRememberNavChoice] = useState<boolean>(false);

  // Explicit Embedded Dock vs. Floating Mini-Player State (default: false)
  const [isFloatingMode, setIsFloatingMode] = useState<boolean>(false);
  const isPipFloating = isFloatingMode;
  const setIsPipFloating = setIsFloatingMode;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 20, initialY: 20 });

  // Real-Time YouTube Progress Tracker
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(0);

  // Search & Navigation UI (searchResults hidden until explicit search; queue tab shown)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | null>('queue');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sleep Timer
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null);
  const [selectedTimerPreset, setSelectedTimerPreset] = useState<number | null>(null);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const timerIntervalRef = useRef<any>(null);
  const floatingPlayerRef = useRef<HTMLDivElement | null>(null);

  // Master YouTube Iframe Ref
  const masterIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Portal Target for embedding in Pomodoro Tab
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isRepeatOneRef.current = isRepeatOne;
  }, [isRepeatOne]);

  // Automatically sync queue state to localStorage ('akari_audio_queue')
  useEffect(() => {
    try {
      if (queue.length === 0) {
        localStorage.removeItem(STORAGE_KEY_QUEUE);
      } else {
        localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
      }
    } catch {}
  }, [queue]);

  // Automatically sync history state to localStorage ('akari_audio_history')
  useEffect(() => {
    try {
      if (history.length === 0) {
        localStorage.removeItem(STORAGE_KEY_HISTORY);
      } else {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
      }
    } catch {}
  }, [history]);

  // Sync queue & history across multiple browser tabs via storage event
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_QUEUE) {
        try {
          const nextQueue = e.newValue ? JSON.parse(e.newValue) : [];
          setQueue(Array.isArray(nextQueue) ? nextQueue : []);
        } catch {
          setQueue([]);
        }
      } else if (e.key === STORAGE_KEY_HISTORY) {
        try {
          const nextHistory = e.newValue ? JSON.parse(e.newValue) : [];
          setHistory(Array.isArray(nextHistory) ? nextHistory : []);
        } catch {
          setHistory([]);
        }
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  // Listen for Navbar/Header floating player launcher & broadcast state
  useEffect(() => {
    const handleToggleFloating = () => {
      setIsFloatingMode((prev) => !prev);
    };
    window.addEventListener('akari_toggle_floating_player', handleToggleFloating);
    return () => {
      window.removeEventListener('akari_toggle_floating_player', handleToggleFloating);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('akari_floating_player_state', {
        detail: { isOpen: isFloatingMode, isPlaying }
      })
    );
  }, [isFloatingMode, isPlaying]);

  // Sync portal target in the DOM
  useEffect(() => {
    const updateTarget = () => {
      const el = document.getElementById('pomodoro-audio-portal');
      setPortalTarget((prev) => (prev === el ? prev : el));
    };
    updateTarget();
    window.addEventListener('akari_navigate_tab', updateTarget);
    const interval = setInterval(updateTarget, 250);
    return () => {
      window.removeEventListener('akari_navigate_tab', updateTarget);
      clearInterval(interval);
    };
  }, [isInPomodoroWorkspace]);

  // Clean up deprecated legacy storage keys once on mount (while preserving akari_audio_queue & akari_audio_history)
  useEffect(() => {
    try {
      localStorage.removeItem('akari_music_queue');
      localStorage.removeItem('akari_music_history');
      localStorage.removeItem('akari_current_track_idx');
      localStorage.removeItem('akari_music_queue_v2');
      localStorage.removeItem('akari_music_history_v2');
      localStorage.removeItem('akari_current_track_idx_v2');
    } catch {}
  }, []);

  // Resolve any raw YouTube URL titles in existing queue/history on mount
  useEffect(() => {
    const isRawUrl = (t: string) => /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(t.trim());

    const resolveUrlTitle = async (youtubeId: string): Promise<string | null> => {
      const preset = PRESET_YOUTUBE_TRACKS.find((p) => p.youtubeId === youtubeId);
      if (preset) return preset.title;
      try {
        const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${youtubeId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.title) return data.title;
        }
      } catch {}
      return null;
    };

    const cleanTracks = async () => {
      let queueChanged = false;
      const updatedQueue = await Promise.all(
        queue.map(async (item) => {
          if (isRawUrl(item.title)) {
            const realTitle = await resolveUrlTitle(item.youtubeId);
            if (realTitle) {
              queueChanged = true;
              return { ...item, title: realTitle };
            }
          }
          return item;
        })
      );
      if (queueChanged) {
        setQueue(updatedQueue);
        setActiveTrack((prev) => {
          if (!prev) return null;
          const match = updatedQueue.find((q) => q.youtubeId === prev.youtubeId);
          return match ? { ...prev, title: match.title } : prev;
        });
      }

      let historyChanged = false;
      const updatedHistory = await Promise.all(
        history.map(async (item) => {
          if (isRawUrl(item.title)) {
            const realTitle = await resolveUrlTitle(item.youtubeId);
            if (realTitle) {
              historyChanged = true;
              return { ...item, title: realTitle };
            }
          }
          return item;
        })
      );
      if (historyChanged) {
        setHistory(updatedHistory);
      }
    };

    cleanTracks();
  }, []);

  // Record to History when a track is played (avoid duplicates, prepend with timestamp, cap at 30)
  const recordToHistory = (track: MusicTrack) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const entry: MusicTrack = { ...track, playedAt: timestamp };
    setHistory((prev) => {
      const filtered = prev.filter((t) => t.youtubeId !== track.youtubeId);
      return [entry, ...filtered].slice(0, 30);
    });
    setCurrentHistoryIndex(0);
  };

  // -------------------------------------------------------------
  // YOUTUBE IFRAME POSTMESSAGE API (Zero-Reload Play/Pause/Seek & Real-Time Sync)
  // -------------------------------------------------------------
  const sendPlayerCommand = useCallback((func: string, args: any[] = []) => {
    const target = masterIframeRef.current;
    if (target && target.contentWindow) {
      target.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func,
          args
        }),
        '*'
      );
    }
  }, []);

  const subscribeToYouTubeTelemetry = useCallback(() => {
    const target = masterIframeRef.current;
    if (!target || !target.contentWindow) return;
    try {
      target.contentWindow.postMessage(
        JSON.stringify({
          event: 'listening',
          id: 'akari_yt_studio',
          channel: 'widget'
        }),
        '*'
      );
      ['onReady', 'onStateChange', 'onError'].forEach((ev) => {
        target.contentWindow?.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'addEventListener',
            args: [ev],
            id: 'akari_yt_studio',
            channel: 'widget'
          }),
          '*'
        );
      });
    } catch {}
  }, []);

  // Strictly memoized iframe src: ONLY changes when youtubeId or initial autoplay changes!
  // Never changes on currentTimeSec, isPlaying, isRepeatOne, or tab navigation!
  const masterIframeSrc = useMemo(() => {
    if (!iframeConfig.youtubeId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `https://www.youtube-nocookie.com/embed/${iframeConfig.youtubeId}?enablejsapi=1&autoplay=${iframeConfig.autoplay}&rel=0&playsinline=1&origin=${origin}`;
  }, [iframeConfig.youtubeId, iframeConfig.autoplay]);

  // Start playing a specific track
  const loadAndPlayTrack = (
    track: MusicTrack,
    recordHist = true,
    revealFloatingPlayer = false
  ) => {
    setActiveTrack(track);
    if (recordHist) {
      recordToHistory(track);
    }
    if (revealFloatingPlayer) {
      setIsPipFloating(true);
    }

    if (iframeConfig.youtubeId === track.youtubeId) {
      setCurrentTimeSec(0);
      setIsPlaying(true);
      sendPlayerCommand('seekTo', [0, true]);
      sendPlayerCommand('playVideo');
    } else {
      setCurrentTimeSec(0);
      setDurationSec(0);
      setIsPlaying(true);
      setIframeConfig({
        youtubeId: track.youtubeId,
        autoplay: 1
      });
    }
  };

  const handlePlay = () => {
    if (!activeTrack) {
      if (queue.length > 0) {
        const firstTrack = queue[currentTrackIndex] || queue[0];
        loadAndPlayTrack(firstTrack, true, false);
      } else {
        showToast('ဖွင့်လှစ်လိုသော တေးဂီတများကို စာရင်းထဲသို့ ထည့်သွင်းပါ');
      }
      return;
    }
    setIsPlaying(true);
    sendPlayerCommand('playVideo');
  };

  const handlePause = () => {
    setIsPlaying(false);
    sendPlayerCommand('pauseVideo');
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  // Seek on progress bar click
  const handleSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (durationSec <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const targetSec = Math.floor((clickX / rect.width) * durationSec);
    setCurrentTimeSec(targetSec);
    sendPlayerCommand('seekTo', [targetSec, true]);
  };

  // Handle when a track naturally finishes playing
  const handleTrackEndedRef = useRef<() => void>(() => {});
  handleTrackEndedRef.current = () => {
    if (isRepeatOneRef.current) {
      setCurrentTimeSec(0);
      sendPlayerCommand('seekTo', [0, true]);
      sendPlayerCommand('playVideo');
      setIsPlaying(true);
    } else if (queue.length > 1) {
      const nextIdx = (currentTrackIndex + 1) % queue.length;
      setCurrentTrackIndex(nextIdx);
      loadAndPlayTrack(queue[nextIdx], true);
    } else {
      setIsPlaying(false);
    }
  };

  // Listen to real-time YouTube postMessage events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      if (!event.origin.includes('youtube.com') && !event.origin.includes('youtube-nocookie.com')) return;

      try {
        const data = JSON.parse(event.data);

        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') {
            setCurrentTimeSec(Math.floor(data.info.currentTime));
          }
          if (typeof data.info.duration === 'number' && data.info.duration > 0) {
            setDurationSec(Math.floor(data.info.duration));
          }
          if (typeof data.info.playerState === 'number') {
            if (data.info.playerState === 1) {
              setIsPlaying(true);
            } else if (data.info.playerState === 2) {
              setIsPlaying(false);
            } else if (data.info.playerState === 0) {
              handleTrackEndedRef.current();
            }
          }
        } else if (data.event === 'onStateChange') {
          if (data.info === 1) {
            setIsPlaying(true);
          } else if (data.info === 2) {
            setIsPlaying(false);
          } else if (data.info === 0) {
            handleTrackEndedRef.current();
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    const handshakeInterval = setInterval(subscribeToYouTubeTelemetry, 1000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(handshakeInterval);
    };
  }, [iframeConfig.youtubeId, subscribeToYouTubeTelemetry]);

  // -------------------------------------------------------------
  // NEXT / PREVIOUS NAVIGATION (QUEUE OR HISTORY)
  // -------------------------------------------------------------
  const executeNavigation = (direction: 'prev' | 'next', source: 'queue' | 'history') => {
    setPendingNavDirection(null);

    if (rememberNavChoice) {
      setNavSourceMode(source);
    }

    if (source === 'queue') {
      if (queue.length === 0) {
        showToast('Queue စာရင်းထဲတွင် သီချင်းမရှိသေးပါခင်ဗျာ။');
        return;
      }
      const nextIdx =
        direction === 'next'
          ? (currentTrackIndex + 1) % queue.length
          : (currentTrackIndex - 1 + queue.length) % queue.length;
      const targetTrack = queue[nextIdx];
      setCurrentTrackIndex(nextIdx);
      loadAndPlayTrack(targetTrack, true);
      showToast(`📑 Queue မှ ဖွင့်နေပါသည်: ${targetTrack.title}`);
    } else {
      if (history.length === 0) {
        showToast('History မှတ်တမ်းထဲတွင် သီချင်းမရှိသေးပါခင်ဗျာ။');
        return;
      }
      const currentIdxInHist = activeTrack
        ? history.findIndex((h) => h.youtubeId === activeTrack.youtubeId)
        : -1;
      const baseIdx = currentIdxInHist !== -1 ? currentIdxInHist : currentHistoryIndex;
      const nextHistIdx =
        direction === 'next'
          ? (baseIdx + 1) % history.length
          : (baseIdx - 1 + history.length) % history.length;
      const targetTrack = history[nextHistIdx];
      setCurrentHistoryIndex(nextHistIdx);
      loadAndPlayTrack(targetTrack, false);
      showToast(`🕒 History မှ ဖွင့်နေပါသည်: ${targetTrack.title}`);
    }
  };

  const handlePrevNextClick = (direction: 'prev' | 'next') => {
    if (navSourceMode === 'queue') {
      executeNavigation(direction, 'queue');
    } else if (navSourceMode === 'history') {
      executeNavigation(direction, 'history');
    } else {
      setPendingNavDirection((curr) => (curr === direction ? null : direction));
    }
  };

  // -------------------------------------------------------------
  // ULTRA-SMOOTH DRAG HANDLERS & VIEWPORT CLAMPING
  // -------------------------------------------------------------
  const clampPositionToViewport = useCallback((rawX: number, rawY: number) => {
    if (typeof window === 'undefined') return { x: rawX, y: rawY };
    const playerEl = floatingPlayerRef.current;
    const playerWidth = playerEl ? playerEl.offsetWidth : 320;
    const playerHeight = playerEl ? playerEl.offsetHeight : 220;
    const maxX = Math.max(10, window.innerWidth - playerWidth - 10);
    // Keep at least 72px clearance from top of viewport so top header/buttons never get cut off
    const maxY = Math.max(10, window.innerHeight - playerHeight - 72);
    return {
      x: Math.max(10, Math.min(maxX, rawX)),
      y: Math.max(10, Math.min(maxY, rawY))
    };
  }, []);

  // Automatically re-clamp position when Sleep Timer or Nav Chooser expands the Floating Player
  useEffect(() => {
    if (!isPipFloating) return;
    const adjust = () => {
      setPosition((prev) => {
        const next = clampPositionToViewport(prev.x, prev.y);
        return next.x === prev.x && next.y === prev.y ? prev : next;
      });
    };
    const raf = requestAnimationFrame(adjust);
    window.addEventListener('resize', adjust);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', adjust);
    };
  }, [isPipFloating, showTimerMenu, pendingNavDirection, isCollapsed, clampPositionToViewport]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setIsDragging(true);
    dragStartRef.current = { startX: clientX, startY: clientY, initialX: position.x, initialY: position.y };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;
      setPosition(
        clampPositionToViewport(
          dragStartRef.current.initialX - deltaX,
          dragStartRef.current.initialY - deltaY
        )
      );
    };

    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMove, { passive: true });
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: true });
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, clampPositionToViewport]);

  // MediaSession API integration
  useEffect(() => {
    if ('mediaSession' in navigator && activeTrack) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: activeTrack.title,
          artist: 'Study Audio Studio',
          album: 'Focused Academic Workspace'
        });
        navigator.mediaSession.setActionHandler('play', () => handlePlay());
        navigator.mediaSession.setActionHandler('pause', () => handlePause());
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          executeNavigation('prev', navSourceMode === 'history' ? 'history' : 'queue');
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          executeNavigation('next', navSourceMode === 'history' ? 'history' : 'queue');
        });
      } catch {}
    }
  }, [activeTrack, queue.length, history.length, navSourceMode]);

  // Sleep Timer Countdown (Stable single interval while timer is active)
  const isSleepTimerRunning = sleepTimerSeconds !== null && sleepTimerSeconds > 0;

  useEffect(() => {
    if (!isSleepTimerRunning) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setSleepTimerSeconds((prev) => {
        if (prev === null || prev <= 1) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setSelectedTimerPreset(null);
          setIsPlaying(false);
          sendPlayerCommand('pauseVideo');
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isSleepTimerRunning, sendPlayerCommand]);

  const selectSleepPreset = (minutes: number) => {
    setSelectedTimerPreset(minutes);
    setSleepTimerSeconds(minutes * 60);
  };

  const addSleepTime = (minutes: number) => {
    setSelectedTimerPreset(null);
    setSleepTimerSeconds((prev) => (prev !== null ? prev + minutes * 60 : minutes * 60));
  };

  const reduceSleepTime = (minutes: number) => {
    setSelectedTimerPreset(null);
    setSleepTimerSeconds((prev) => {
      if (prev === null) return minutes * 60;
      const next = prev - minutes * 60;
      return next > 0 ? next : null;
    });
  };

  // Real YouTube Search Engine
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);

    const ytUrlMatch = query.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i
    );
    if (ytUrlMatch && ytUrlMatch[1]) {
      const vid = ytUrlMatch[1];
      let resolvedTitle =
        PRESET_YOUTUBE_TRACKS.find((p) => p.youtubeId === vid)?.title || `YouTube Video (${vid})`;
      try {
        const metaRes = await fetch(
          `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${vid}`
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (metaData && metaData.title) {
            resolvedTitle = metaData.title;
          }
        }
      } catch {}
      setSearchResults([{ id: `c_${Date.now()}`, title: resolvedTitle, youtubeId: vid }]);
      setIsSearching(false);
      return;
    }

    try {
      const res = await fetch('/api/youtube/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          setSearchResults(
            data.results.map((item: { videoId: string; title: string }, idx: number) => ({
              id: `yt_${Date.now()}_${idx}`,
              title: item.title,
              youtubeId: item.videoId
            }))
          );
          setIsSearching(false);
          return;
        }
      }
      throw new Error('Fallback search');
    } catch {
      setSearchResults(PRESET_YOUTUBE_TRACKS);
    }
    setIsSearching(false);
  };

  // Queue Operations: Reorder & Remove
  const moveTrackInQueue = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= queue.length) return;
    const updated = [...queue];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setQueue(updated);
    if (currentTrackIndex === fromIndex) {
      setCurrentTrackIndex(toIndex);
    }
  };

  const removeFromQueue = (indexToRemove: number) => {
    setQueue((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      if (next.length === 0) {
        try {
          localStorage.removeItem(STORAGE_KEY_QUEUE);
        } catch {}
      }
      return next;
    });
    if (indexToRemove === currentTrackIndex && queue.length > 1) {
      setCurrentTrackIndex(0);
    }
  };

  const handleAddToQueue = (track: MusicTrack) => {
    setQueue((prev) => {
      if (prev.some((q) => q.youtubeId === track.youtubeId)) {
        return prev;
      }
      return [...prev, track];
    });
    if (!activeTrack) {
      setCurrentTrackIndex(0);
      loadAndPlayTrack(track, true, false);
      showToast(`➕ Queue ထဲသို့ ထည့်ပြီး စတင်ဖွင့်နေပါသည်: ${track.title}`);
    } else {
      showToast(`➕ Queue ထဲသို့ ထည့်ပြီးပါပြီ: ${track.title}`);
    }
  };

  const clearEntireQueue = () => {
    setQueue([]);
    setCurrentTrackIndex(0);
    try {
      localStorage.removeItem(STORAGE_KEY_QUEUE);
    } catch {}
    // Keep current playback state untouched (do NOT pause if playing, and if paused keep clean)
    if (isPlayingRef.current) {
      sendPlayerCommand('playVideo');
    }
    showToast('Queue စာရင်းတစ်ခုလုံးကို ရှင်းလင်းပြီးပါပြီခင်ဗျာ။');
  };

  const clearEntireHistory = () => {
    setHistory([]);
    setCurrentHistoryIndex(0);
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch {}
    showToast('နားထောင်ခဲ့သည့် History အားလုံးကို ရှင်းထုတ်ပြီးပါပြီခင်ဗျာ။');
  };

  const removeFromHistory = (indexToRemove: number) => {
    setHistory((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      if (next.length === 0) {
        try {
          localStorage.removeItem(STORAGE_KEY_HISTORY);
        } catch {}
      }
      return next;
    });
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const totalSecs = Math.floor(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercentage =
    durationSec > 0 ? Math.min(100, (currentTimeSec / durationSec) * 100) : 0;

  // Shared Queue vs History Navigation Choice Popover
  const renderNavSourceChooser = () => {
    if (!pendingNavDirection) return null;
    const dirLabel = pendingNavDirection === 'next' ? '⏭ နောက်တစ်ပုဒ် (Next)' : '⏮ ရှေ့တစ်ပုဒ် (Previous)';
    return (
      <div className="p-3 rounded-xl bg-slate-900/95 border border-indigo-500/60 shadow-xl space-y-2.5 animate-in fade-in">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-[11px] font-bold text-indigo-300">
            {dirLabel} — မည်သည့်စာရင်းမှ သွားမည်နည်း?
          </span>
          <button
            type="button"
            onClick={() => setPendingNavDirection(null)}
            className="text-slate-400 hover:text-rose-400 text-xs font-bold px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => executeNavigation(pendingNavDirection, 'queue')}
            className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/50 text-left transition-all cursor-pointer"
          >
            <div className="text-xs font-bold text-indigo-200 flex items-center gap-1">
              <span>📑</span>
              <span>Queue မှ သုံးမည်</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              လက်ရှိ Queue ({queue.length} ပုဒ်)
            </div>
          </button>

          <button
            type="button"
            onClick={() => executeNavigation(pendingNavDirection, 'history')}
            className="p-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/50 text-left transition-all cursor-pointer"
          >
            <div className="text-xs font-bold text-amber-200 flex items-center gap-1">
              <span>🕒</span>
              <span>History မှ သုံးမည်</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              နားထောင်ခဲ့သော ({history.length} ပုဒ်)
            </div>
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer select-none pt-0.5">
          <input
            type="checkbox"
            checked={rememberNavChoice}
            onChange={(e) => setRememberNavChoice(e.target.checked)}
            className="rounded border-slate-700 bg-slate-950 text-indigo-500"
          />
          <span>ရွေးချယ်မှုကို မှတ်ထားမည် (နောက်တစ်ကြိမ် ထပ်မမေးဘဲ တိုက်ရိုက်သုံးမည်)</span>
        </label>
      </div>
    );
  };

  // Whether the player is rendered in the floating mini-player vs docked in the card
  const showFloatingPlayer = isFloatingMode || (!isInPomodoroWorkspace && Boolean(masterIframeSrc));

  // -------------------------------------------------------------
  // MAIN STUDIO PANEL CONTENT (IN-APP DOCKED CARD)
  // -------------------------------------------------------------
  const mainStudioContent = (
    <div className="relative w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 overflow-hidden shadow-xl space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-2.5 rounded-xl bg-indigo-950/90 border border-indigo-700/80 text-indigo-200 text-xs text-center font-medium animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-[#090e1a] border border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <span className="text-amber-400">🎧</span>
          <span>STUDY AUDIO STUDIO</span>
        </div>

        <button
          type="button"
          onClick={() => setIsFloatingMode((prev) => !prev)}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
            isFloatingMode
              ? 'bg-indigo-600 text-white border-indigo-500 shadow'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <span>🔲</span>
          <span>{isFloatingMode ? 'Floating Player ပိတ်မည်' : 'Floating Player ဖွင့်မည်'}</span>
        </button>
      </div>

      {/* 2. Main Studio Inner Controls */}
      <div className="w-full min-w-0 p-4 rounded-2xl bg-[#0b1222]/90 border border-slate-800 space-y-4 overflow-hidden">
        {/* Search Input */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="အဆိုတော်၊ သီချင်းနာမည် ရိုက်ရှာပါ (မြန်မာ/English/မည်သည့်ဘာသာမဆို)"
            className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow shrink-0 cursor-pointer"
          >
            🔍 {isSearching ? 'ရှာနေသည်...' : 'ရှာဖွေမည်'}
          </button>
        </form>

        {/* Search Results (Real YouTube Results with Thumbnails) */}
        {searchResults.length > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 overflow-hidden">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300">
                🔍 YouTube မှ ရှာဖွေတွေ့ရှိသော ရလဒ်များ ({searchResults.length}):
              </span>
              <button
                type="button"
                onClick={() => setSearchResults([])}
                className="text-[10px] text-slate-400 hover:text-rose-400 font-bold cursor-pointer"
              >
                ✕ ပိတ်မည်
              </button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {searchResults.map((res) => (
                <div
                  key={res.id}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2.5 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <img
                      src={`https://i.ytimg.com/vi/${res.youtubeId}/mqdefault.jpg`}
                      alt={res.title}
                      className="w-12 h-7 object-cover rounded border border-slate-700 shrink-0 bg-slate-950"
                      loading="lazy"
                    />
                    <span className="text-xs text-slate-200 truncate font-medium" title={res.title}>
                      {res.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const updatedQueue = [
                          res,
                          ...queue.filter((q) => q.youtubeId !== res.youtubeId)
                        ];
                        setQueue(updatedQueue);
                        setCurrentTrackIndex(0);
                        loadAndPlayTrack(res, true, false);
                        showToast(`▶ ဖွင့်နေပါသည်: ${res.title}`);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer hover:bg-rose-500"
                    >
                      ▶ ဖွင့်မည်
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddToQueue(res)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-bold cursor-pointer hover:bg-slate-700"
                    >
                      + Queue
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Presets (Quick Tag Play + Queue) */}
        <div className="flex flex-wrap gap-2">
          {PRESET_YOUTUBE_TRACKS.map((track) => {
            const isCurrent = activeTrack?.youtubeId === track.youtubeId;
            return (
              <div
                key={track.id}
                className={`inline-flex items-center rounded-xl border text-xs font-semibold overflow-hidden transition-all ${
                  isCurrent
                    ? 'bg-rose-950/70 border-rose-600 text-rose-300 shadow'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const idx = queue.findIndex((t) => t.youtubeId === track.youtubeId);
                    if (idx !== -1) {
                      setCurrentTrackIndex(idx);
                    } else {
                      setQueue((prev) => [track, ...prev]);
                      setCurrentTrackIndex(0);
                    }
                    loadAndPlayTrack(track, true, false);
                  }}
                  className="px-3 py-1.5 hover:text-white transition-colors cursor-pointer"
                  title="တိုက်ရိုက်ဖွင့်မည်"
                >
                  {track.title}
                </button>
                <button
                  type="button"
                  onClick={() => handleAddToQueue(track)}
                  className="px-2 py-1.5 border-l border-slate-800/80 bg-slate-900/70 hover:bg-indigo-600/40 text-slate-400 hover:text-indigo-200 text-[10px] font-bold transition-colors cursor-pointer"
                  title="+ Queue စာရင်းထဲသို့ ထည့်မည်"
                >
                  + Queue
                </button>
              </div>
            );
          })}
        </div>

        {/* 
          STRICT 16:9 VIDEO PLAYER VIEWPORT WRAPPER (DOCKED VS FLOATING)
          Locked inside parent card with relative w-full aspect-video overflow-hidden
        */}
        {masterIframeSrc && (
          !showFloatingPlayer ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-inner border border-slate-800/80 my-3">
              <div id="youtube-player" className="absolute inset-0 w-full h-full pointer-events-auto">
                <iframe
                  ref={masterIframeRef}
                  key={iframeConfig.youtubeId}
                  onLoad={subscribeToYouTubeTelemetry}
                  src={masterIframeSrc}
                  title={activeTrack ? activeTrack.title : 'Study Audio Studio'}
                  className="w-full h-full object-cover border-0"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-950/90 shadow-inner border border-indigo-500/40 my-3 flex flex-col items-center justify-center p-4 text-center gap-2.5">
              <span className="text-2xl">🔲</span>
              <p className="text-xs font-semibold text-indigo-300 max-w-md leading-relaxed">
                Currently playing in floating mini-player (အောက်ခြေ floating window တွင် ဖွင့်ထားပါသည်)
              </p>
              <button
                type="button"
                onClick={() => setIsFloatingMode(false)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>↙</span>
                <span>Dock back to card (ကတ်ထဲသို့ ပြန်ထည့်မည်)</span>
              </button>
            </div>
          )
        )}

        {/* Controls Bar & Real-Time Progress */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isPlaying ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span
                className="text-xs font-bold text-slate-200 truncate"
                title={activeTrack ? activeTrack.title : 'နားဆင်လိုသော တေးဂီတကို ရွေးချယ်ပါ'}
              >
                🎵 {activeTrack ? activeTrack.title : 'နားဆင်လိုသော တေးဂီတကို ရွေးချယ်ပါ'}
              </span>
            </div>

            {/* Toggleable Queue & History Buttons (Clicking twice hides the drawer below player) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab((prev) => (prev === 'queue' ? null : 'queue'))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  activeTab === 'queue'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
                title="တစ်ချက်နှိပ်လျှင် ဖွင့်မည်၊ နောက်တစ်ချက်နှိပ်လျှင် ပိတ်မည်"
              >
                📑 Queue ({queue.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab((prev) => (prev === 'history' ? null : 'history'))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
                title="တစ်ချက်နှိပ်လျှင် ဖွင့်မည်၊ နောက်တစ်ချက်နှိပ်လျှင် ပိတ်မည်"
              >
                🕒 History ({history.length})
              </button>
            </div>
          </div>

          {/* Clickable Real-Time Progress Bar */}
          <div className="space-y-1">
            <div
              onClick={handleSeekBarClick}
              title="နှိပ်၍ သီချင်းအချိန် ရွှေ့နိုင်ပါသည်"
              className="w-full bg-slate-800 h-2 rounded-full overflow-hidden cursor-pointer group relative"
            >
              <div
                className="bg-rose-600 group-hover:bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>{formatTime(currentTimeSec)}</span>
              <span>{durationSec > 0 ? formatTime(durationSec) : '--:--'}</span>
            </div>
          </div>

          {/* Next / Previous Queue vs History Prompt */}
          {renderNavSourceChooser()}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrevNextClick('prev')}
                title="ရှေ့တစ်ပုဒ် (Queue သို့မဟုတ် History)"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                ⏮
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow flex items-center gap-1.5 cursor-pointer"
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>

              <button
                type="button"
                onClick={() => handlePrevNextClick('next')}
                title="နောက်တစ်ပုဒ် (Queue သို့မဟုတ် History)"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                ⏭
              </button>

              {/* Quick Switcher Pill for Next/Prev Source Mode */}
              <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setNavSourceMode('ask');
                    setRememberNavChoice(false);
                  }}
                  className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    navSourceMode === 'ask'
                      ? 'bg-slate-800 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Next/Prev နှိပ်တိုင်း Queue သို့မဟုတ် History ရွေးရန် မေးမည်"
                >
                  မေးမည်
                </button>
                <button
                  type="button"
                  onClick={() => setNavSourceMode('queue')}
                  className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    navSourceMode === 'queue'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Next/Prev နှိပ်လျှင် Queue စာရင်းကို သုံးမည်"
                >
                  📑 Queue
                </button>
                <button
                  type="button"
                  onClick={() => setNavSourceMode('history')}
                  className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    navSourceMode === 'history'
                      ? 'bg-amber-600 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Next/Prev နှိပ်လျှင် History မှတ်တမ်းကို သုံးမည်"
                >
                  🕒 History
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsRepeatOne((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isRepeatOne
                  ? 'bg-amber-950/60 border-amber-600/60 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🔁</span>
              <span>{isRepeatOne ? 'Repeat 1 (ON)' : 'Repeat Off'}</span>
            </button>
          </div>
        </div>

        {/* QUEUE DRAWER (PLAY, REORDER, REMOVE & CLEAR ALL) */}
        {activeTab === 'queue' && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">
                📑 သီချင်းစာရင်း (PLAYLIST QUEUE)
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={clearEntireQueue}
                  className="text-[11px] text-rose-400 hover:underline font-semibold cursor-pointer"
                >
                  Clear All (အားလုံးဖျက်မည်)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  className="text-[11px] text-slate-400 hover:text-white font-bold cursor-pointer"
                  title="Queue စာရင်း ပိတ်မည်"
                >
                  ✕
                </button>
              </div>
            </div>
            {queue.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                ဖွင့်လှစ်လိုသော တေးဂီတများကို စာရင်းထဲသို့ ထည့်သွင်းပါ
              </p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {queue.map((track, idx) => (
                  <div
                    key={`${track.id}_${idx}`}
                    className={`p-2 rounded-lg flex items-center justify-between gap-2 text-xs transition-all ${
                      activeTrack?.youtubeId === track.youtubeId && idx === currentTrackIndex
                        ? 'bg-rose-950/70 border border-rose-800 text-rose-200'
                        : 'bg-slate-900/50 text-slate-300'
                    }`}
                  >
                    <span
                      onClick={() => {
                        setCurrentTrackIndex(idx);
                        loadAndPlayTrack(track, true, false);
                      }}
                      className="truncate cursor-pointer hover:underline font-medium flex-1 pr-2"
                      title={track.title}
                    >
                      {idx + 1}. {track.title}
                    </span>

                    {/* Play Directly, Reorder Buttons (▲ / ▼) & Remove [✕] */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTrackIndex(idx);
                          loadAndPlayTrack(track, true, false);
                        }}
                        className="px-2 py-0.5 rounded bg-rose-600/80 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                        title="တိုက်ရိုက်ဖွင့်မည်"
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveTrackInQueue(idx, idx - 1)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-[10px] cursor-pointer"
                        title="အပေါ်ရွှေ့မည်"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === queue.length - 1}
                        onClick={() => moveTrackInQueue(idx, idx + 1)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-[10px] cursor-pointer"
                        title="အောက်ရွှေ့မည်"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromQueue(idx)}
                        className="text-slate-400 hover:text-rose-400 px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-rose-950/60 font-bold text-[10px] cursor-pointer"
                        title="ဖယ်ရှားမည်"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LISTENING HISTORY DRAWER (PLAY AGAIN, CLEAR HISTORY & CLOSE) */}
        {activeTab === 'history' && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">
                🕒 နားထောင်ခဲ့သည့် မှတ်တမ်းများ (HISTORY)
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={clearEntireHistory}
                  className="text-[11px] text-rose-400 hover:underline font-semibold cursor-pointer"
                >
                  Clear History (မှတ်တမ်းအားလုံးဖျက်မည်)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  className="text-[11px] text-slate-400 hover:text-white font-bold cursor-pointer"
                  title="History မှတ်တမ်း ပိတ်မည်"
                >
                  ✕
                </button>
              </div>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">နားထောင်ခဲ့သည့် မှတ်တမ်း မရှိသေးပါ</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {history.map((item, i) => (
                  <div
                    key={`${item.youtubeId}_${i}`}
                    className={`p-2 rounded-lg flex items-center justify-between gap-2 text-xs transition-all ${
                      activeTrack?.youtubeId === item.youtubeId
                        ? 'bg-amber-950/60 border border-amber-700/60 text-amber-200'
                        : 'bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <span className="truncate font-medium" title={item.title}>
                        {i + 1}. {item.title}
                      </span>
                      {item.playedAt && (
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          ({item.playedAt})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentHistoryIndex(i);
                          loadAndPlayTrack(item, false, false);
                        }}
                        className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50 text-[10px] text-cyan-300 hover:bg-cyan-900/80 font-bold cursor-pointer"
                      >
                        ▶ Play Again (ပြန်ဖွင့်မည်)
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromHistory(i)}
                        className="text-slate-400 hover:text-rose-400 px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-rose-950/60 font-bold text-[10px] cursor-pointer"
                        title="မှတ်တမ်းမှ ဖယ်ရှားမည်"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // FLOATING MINI-PLAYER (PORTALED TO DOCUMENT.BODY WHEN ACTIVE)
  // -------------------------------------------------------------
  const floatingMiniPlayer = showFloatingPlayer ? (
    <div
      ref={floatingPlayerRef}
      className="fixed bottom-5 right-5 z-[9999] w-[320px] rounded-xl shadow-2xl border-2 border-indigo-500/50 bg-slate-950 overflow-hidden select-none"
    >
      {/* 16:9 Mini-Player Video Viewport with Header Overlay */}
      <div className="relative w-full aspect-video bg-black overflow-hidden">
        {/* Tiny Header Overlay inside Mini-Player */}
        <div
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          style={{ touchAction: 'none' }}
          className="absolute top-0 inset-x-0 z-20 px-2.5 py-1.5 bg-gradient-to-b from-slate-950/95 via-slate-950/75 to-transparent flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span
              className="text-[11px] font-bold text-slate-100 truncate"
              title={activeTrack ? activeTrack.title : 'Study Audio Studio'}
            >
              {activeTrack ? activeTrack.title : 'နားဆင်လိုသော တေးဂီတကို ရွေးချယ်ပါ'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsFloatingMode(false);
                if (!isInPomodoroWorkspace && onNavigateToPomodoroTab) {
                  onNavigateToPomodoroTab();
                }
              }}
              className="px-2 py-0.5 rounded bg-indigo-600/90 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer shadow"
              title="Dock back to Study Audio Studio card"
            >
              ↙
            </button>
            <button
              type="button"
              onClick={() => setIsFloatingMode(false)}
              className="px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-rose-600 text-slate-200 hover:text-white text-[10px] font-bold cursor-pointer shadow"
              title="Close Floating Player"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Embedded Iframe or Idle Placeholder inside 16:9 Floating Viewport */}
        {masterIframeSrc ? (
          <div id="youtube-player" className="absolute inset-0 w-full h-full pointer-events-auto">
            <iframe
              ref={masterIframeRef}
              key={iframeConfig.youtubeId}
              onLoad={subscribeToYouTubeTelemetry}
              src={masterIframeSrc}
              title={activeTrack ? activeTrack.title : 'Study Audio Studio'}
              className="w-full h-full object-cover border-0"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <span className="text-xl mb-1">🎧</span>
            <span className="text-[11px] text-slate-400">
              နားဆင်လိုသော တေးဂီတကို ရွေးချယ်ပါ
            </span>
          </div>
        )}
      </div>

      {/* Compact Mini-Player Transport & Sleep Timer Drawer */}
      <div className="p-2.5 bg-slate-950 border-t border-slate-800/90 space-y-2">
        {/* Progress Bar */}
        <div className="space-y-1">
          <div
            onClick={handleSeekBarClick}
            className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden cursor-pointer"
          >
            <div
              className="bg-rose-600 h-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>
              ⏱️ {formatTime(currentTimeSec)} / {durationSec > 0 ? formatTime(durationSec) : '--:--'}
            </span>
            <button
              type="button"
              onClick={() => setShowTimerMenu((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                sleepTimerSeconds !== null
                  ? 'bg-amber-950/80 text-amber-300 border-amber-600/60 animate-pulse'
                  : showTimerMenu
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>🌙</span>
              <span>
                {sleepTimerSeconds !== null
                  ? `${Math.floor(sleepTimerSeconds / 60)}:${
                      sleepTimerSeconds % 60 < 10 ? '0' : ''
                    }${sleepTimerSeconds % 60}`
                  : 'Timer'}
              </span>
            </button>
          </div>
        </div>

        {renderNavSourceChooser()}

        {showTimerMenu && (
          <div className="p-2 rounded-xl bg-slate-900 border border-indigo-500/40 space-y-2 text-xs">
            <div className="grid grid-cols-4 gap-1">
              {[15, 30, 45, 60].map((m) => {
                const isSelected = selectedTimerPreset === m && sleepTimerSeconds !== null;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => selectSleepPreset(m)}
                    className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    {m}m
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => reduceSleepTime(5)}
                  className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 text-[10px] font-bold border border-slate-800 cursor-pointer"
                >
                  -5m
                </button>
                <button
                  type="button"
                  onClick={() => addSleepTime(5)}
                  className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 text-[10px] font-bold border border-slate-800 cursor-pointer"
                >
                  +5m
                </button>
              </div>
              {sleepTimerSeconds !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setSleepTimerSeconds(null);
                    setSelectedTimerPreset(null);
                  }}
                  className="text-[10px] text-rose-400 hover:underline font-bold cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePrevNextClick('prev')}
              className="p-1 rounded bg-slate-900 text-slate-300 text-xs cursor-pointer hover:bg-slate-800"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={togglePlayPause}
              className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400"
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              type="button"
              onClick={() => handlePrevNextClick('next')}
              className="p-1 rounded bg-slate-900 text-slate-300 text-xs cursor-pointer hover:bg-slate-800"
            >
              ⏭
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsRepeatOne((prev) => !prev)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
              isRepeatOne
                ? 'bg-amber-950 text-amber-300 border-amber-700'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            🔁 {isRepeatOne ? '1' : 'Off'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Render Main Studio Panel (Portaled into Pomodoro or in-line if in workspace) */}
      {portalTarget
        ? createPortal(mainStudioContent, portalTarget)
        : isInPomodoroWorkspace
        ? mainStudioContent
        : null}

      {/* Render Floating Mini-Player at Root via Portal */}
      {typeof document !== 'undefined' && floatingMiniPlayer
        ? createPortal(floatingMiniPlayer, document.body)
        : floatingMiniPlayer}
    </>
  );
};
