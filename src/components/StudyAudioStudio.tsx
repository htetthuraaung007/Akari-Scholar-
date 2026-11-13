import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface MusicTrack {
  id: string;
  title: string;
  youtubeId: string;
}

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

export const StudyAudioStudio: React.FC<StudyAudioStudioProps> = ({
  onNavigateToPomodoroTab,
  isInPomodoroWorkspace = true
}) => {
  // Queue & Track State
  const [queue, setQueue] = useState<MusicTrack[]>(() => {
    const saved = localStorage.getItem('akari_music_queue_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(() => {
    const idx = localStorage.getItem('akari_current_track_idx_v2');
    const parsed = idx ? parseInt(idx, 10) : 0;
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  });

  // History State
  const [history, setHistory] = useState<MusicTrack[]>(() => {
    const saved = localStorage.getItem('akari_music_history_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  });

  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(0);

  // Active Track & Strictly Stable Iframe Config
  // iframeConfig ONLY changes when a different song (youtubeId) is loaded.
  const initialTrack: MusicTrack | null = queue[currentTrackIndex] || queue[0] || null;
  const [activeTrack, setActiveTrack] = useState<MusicTrack | null>(initialTrack);
  const [iframeConfig, setIframeConfig] = useState<{ youtubeId: string; autoplay: 0 | 1 }>({
    youtubeId: initialTrack ? initialTrack.youtubeId : '',
    autoplay: 0
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);

  const [isRepeatOne, setIsRepeatOne] = useState<boolean>(() => {
    return localStorage.getItem('akari_music_repeat_one_v2') === 'true';
  });
  const isRepeatOneRef = useRef<boolean>(isRepeatOne);

  // Next / Previous Navigation Source Mode ('ask' | 'queue' | 'history')
  const [navSourceMode, setNavSourceMode] = useState<NavSourceMode>(() => {
    const saved = localStorage.getItem('akari_music_nav_mode_v2');
    if (saved === 'queue' || saved === 'history' || saved === 'ask') return saved;
    return 'ask';
  });
  const [pendingNavDirection, setPendingNavDirection] = useState<'prev' | 'next' | null>(null);
  const [rememberNavChoice, setRememberNavChoice] = useState<boolean>(false);

  // Floating PiP States & Smooth Dragging (Hidden by default on launch; opens on explicit user interaction)
  const [isPipFloating, setIsPipFloating] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 20, initialY: 80 });

  // Real-Time YouTube Progress Tracker
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(0);

  // Search & Navigation UI (activeTab supports null so clicking Queue or History twice hides the drawer)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | null>('queue');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sleep Timer
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null);
  const [selectedTimerPreset, setSelectedTimerPreset] = useState<number | null>(null);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const timerIntervalRef = useRef<any>(null);
  const floatingPlayerRef = useRef<HTMLDivElement | null>(null);

  // Single Permanent Master YouTube Iframe & Slot Refs
  const masterIframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeWrapperRef = useRef<HTMLDivElement | null>(null);
  const videoSlotRef = useRef<HTMLDivElement | null>(null);

  // Portal Target for embedding in Pomodoro Tab while master iframe stays permanently at Root
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

  // Listen for Navbar/Header floating player launcher & broadcast state
  useEffect(() => {
    const handleToggleFloating = () => {
      setIsPipFloating((prev) => !prev);
    };
    window.addEventListener('akari_toggle_floating_player', handleToggleFloating);
    return () => {
      window.removeEventListener('akari_toggle_floating_player', handleToggleFloating);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('akari_floating_player_state', {
        detail: { isOpen: isPipFloating, isPlaying }
      })
    );
  }, [isPipFloating, isPlaying]);

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

  // Synchronize the single permanent master iframe position over videoSlotRef when in Pomodoro view
  const syncIframePosition = useCallback(() => {
    const wrapper = iframeWrapperRef.current;
    if (!wrapper) return;

    const slot = videoSlotRef.current;
    const isSlotActive =
      isInPomodoroWorkspace && Boolean(portalTarget) && Boolean(slot) && Boolean(iframeConfig.youtubeId);

    if (isSlotActive && slot) {
      const rect = slot.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        wrapper.style.position = 'fixed';
        wrapper.style.top = `${rect.top}px`;
        wrapper.style.left = `${rect.left}px`;
        wrapper.style.width = `${rect.width}px`;
        wrapper.style.height = `${rect.height}px`;
        wrapper.style.opacity = '1';
        wrapper.style.pointerEvents = 'auto';
        wrapper.style.zIndex = '20';
        wrapper.style.borderRadius = '0.75rem';
        wrapper.style.overflow = 'hidden';
        return;
      }
    }

    // Outside Pomodoro tab: keep the exact same iframe alive & hidden without unmounting
    wrapper.style.position = 'fixed';
    wrapper.style.top = '-9999px';
    wrapper.style.left = '-9999px';
    wrapper.style.width = '1px';
    wrapper.style.height = '1px';
    wrapper.style.opacity = '0';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.zIndex = '-50';
  }, [isInPomodoroWorkspace, portalTarget, iframeConfig.youtubeId]);

  useEffect(() => {
    syncIframePosition();
    window.addEventListener('scroll', syncIframePosition, true);
    window.addEventListener('resize', syncIframePosition);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && videoSlotRef.current) {
      ro = new ResizeObserver(syncIframePosition);
      ro.observe(videoSlotRef.current);
    }

    const rafId = requestAnimationFrame(syncIframePosition);
    const timerId = setTimeout(syncIframePosition, 100);

    return () => {
      window.removeEventListener('scroll', syncIframePosition, true);
      window.removeEventListener('resize', syncIframePosition);
      if (ro) ro.disconnect();
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [syncIframePosition, activeTab, searchResults.length, pendingNavDirection]);

  // Sync to Storage
  useEffect(() => {
    try {
      localStorage.setItem('akari_music_queue_v2', JSON.stringify(queue));
      localStorage.setItem('akari_current_track_idx_v2', String(currentTrackIndex));
      localStorage.setItem('akari_music_repeat_one_v2', String(isRepeatOne));
      localStorage.setItem('akari_music_history_v2', JSON.stringify(history));
      localStorage.setItem('akari_music_nav_mode_v2', navSourceMode);
    } catch {}
  }, [queue, currentTrackIndex, isRepeatOne, history, navSourceMode]);

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

  // Record to History when a track is played
  const recordToHistory = (track: MusicTrack) => {
    setHistory((prev) => {
      const filtered = prev.filter((t) => t.youtubeId !== track.youtubeId);
      return [track, ...filtered].slice(0, 30);
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
        showToast('ဖွင့်လှစ်လိုသော တေးဂီတ သို့မဟုတ် Lofi beats များကို ရှာဖွေထည့်သွင်းပါ');
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
    setQueue((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    if (indexToRemove === currentTrackIndex && queue.length > 1) {
      setCurrentTrackIndex(0);
    }
  };

  const clearEntireQueue = () => {
    setQueue([]);
    setCurrentTrackIndex(0);
    // Keep current playback state untouched (do NOT pause if playing, and if paused keep clean)
    if (isPlayingRef.current) {
      sendPlayerCommand('playVideo');
    }
    showToast('Queue စာရင်းတစ်ခုလုံးကို ရှင်းလင်းပြီးပါပြီခင်ဗျာ။');
  };

  const clearEntireHistory = () => {
    setHistory([]);
    showToast('နားထောင်ခဲ့သည့် History အားလုံးကို ရှင်းထုတ်ပြီးပါပြီခင်ဗျာ။');
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

  // -------------------------------------------------------------
  // MAIN STUDIO PANEL CONTENT (IN-APP)
  // -------------------------------------------------------------
  const mainStudioContent = (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-2.5 rounded-xl bg-indigo-950/90 border border-indigo-700/80 text-indigo-200 text-xs text-center font-medium animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#090e1a] border border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <span className="text-amber-400">🎧</span>
          <span>STUDY AUDIO STUDIO</span>
        </div>

        <button
          type="button"
          onClick={() => setIsPipFloating((prev) => !prev)}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
            isPipFloating
              ? 'bg-indigo-600 text-white border-indigo-500 shadow'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <span>🔲</span>
          <span>{isPipFloating ? 'Floating Player ပိတ်မည်' : 'Floating Player ဖွင့်မည်'}</span>
        </button>
      </div>

      {/* 2. Main Studio Panel */}
      <div className="p-4 rounded-2xl bg-[#0b1222]/90 border border-slate-800 space-y-4">
        {/* Search Input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="အဆိုတော်၊ သီချင်းနာမည် ရိုက်ရှာပါ (မြန်မာ/English/မည်သည့်ဘာသာမဆို)"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
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
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
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
                        loadAndPlayTrack(res, true, true);
                        showToast(`▶ ဖွင့်နေပါသည်: ${res.title}`);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer hover:bg-rose-500"
                    >
                      ▶ ဖွင့်မည်
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!queue.some((q) => q.youtubeId === res.youtubeId)) {
                          setQueue((prev) => [...prev, res]);
                        }
                        showToast('Queue ထဲသို့ ထည့်ပြီးပါပြီခင်ဗျာ။');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-bold cursor-pointer hover:bg-slate-700"
                    >
                      ➕ Queue
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESET_YOUTUBE_TRACKS.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => {
                const idx = queue.findIndex((t) => t.youtubeId === track.youtubeId);
                if (idx !== -1) {
                  setCurrentTrackIndex(idx);
                } else {
                  setQueue([track, ...queue]);
                  setCurrentTrackIndex(0);
                }
                loadAndPlayTrack(track, true, true);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                activeTrack?.youtubeId === track.youtubeId
                  ? 'bg-rose-950/70 border-rose-600 text-rose-300 shadow'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              {track.title}
            </button>
          ))}
        </div>

        {/* Controls Bar & Real-Time Progress */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isPlaying ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span
                className="text-xs font-bold text-slate-200 truncate"
                title={activeTrack ? activeTrack.title : 'ရွေးချယ်ထားသော သီချင်း မရှိသေးပါ'}
              >
                🎵 {activeTrack ? activeTrack.title : 'ရွေးချယ်ထားသော သီချင်း မရှိသေးပါ (Idle)'}
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
            <div className="flex items-center gap-2">
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
                onClick={() => {
                  if (!isPlaying && (activeTrack || queue.length > 0)) {
                    setIsPipFloating(true);
                  }
                  togglePlayPause();
                }}
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

        {/* 
          IN-APP VIDEO SLOT ANCHOR
          The single permanent master iframe at Root overlays this slot seamlessly when in Pomodoro view.
          Because the iframe never unmounts or changes src on tab switches, returning to Pomodoro NEVER restarts the song!
        */}
        {iframeConfig.youtubeId && (
          <div
            ref={videoSlotRef}
            className="w-full aspect-video rounded-xl overflow-hidden border border-slate-800 mt-2 bg-black shadow-lg"
          />
        )}

        {/* QUEUE DRAWER (REORDER, CLEAR ALL & CLOSE) */}
        {activeTab === 'queue' && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in">
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
                ဖွင့်လှစ်လိုသော တေးဂီတ သို့မဟုတ် Lofi beats များကို အပေါ်ဘက်မှ ရှာဖွေထည့်သွင်းပါ
              </p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {queue.map((track, idx) => (
                  <div
                    key={`${track.id}_${idx}`}
                    className={`p-2 rounded-lg flex items-center justify-between text-xs transition-all ${
                      activeTrack?.youtubeId === track.youtubeId && idx === currentTrackIndex
                        ? 'bg-rose-950/70 border border-rose-800 text-rose-200'
                        : 'bg-slate-900/50 text-slate-300'
                    }`}
                  >
                    <span
                      onClick={() => {
                        setCurrentTrackIndex(idx);
                        loadAndPlayTrack(track, true, true);
                      }}
                      className="truncate cursor-pointer hover:underline font-medium flex-1 pr-2"
                    >
                      {idx + 1}. {track.title}
                    </span>

                    {/* Reorder Buttons (▲ / ▼) & Remove */}
                    <div className="flex items-center gap-1 shrink-0">
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
                        className="text-slate-500 hover:text-rose-400 px-1.5 font-bold cursor-pointer"
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

        {/* LISTENING HISTORY DRAWER (CLEAR HISTORY & CLOSE) */}
        {activeTab === 'history' && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in">
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
                  Clear History (မှတ်တမ်းဖျက်မည်)
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
                    className={`p-2 rounded-lg flex items-center justify-between text-xs transition-all ${
                      activeTrack?.youtubeId === item.youtubeId
                        ? 'bg-amber-950/60 border border-amber-700/60 text-amber-200'
                        : 'bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <span className="truncate flex-1 pr-2">
                      {i + 1}. {item.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentHistoryIndex(i);
                        loadAndPlayTrack(item, false, true);
                      }}
                      className="text-[10px] text-cyan-400 hover:underline font-bold cursor-pointer shrink-0"
                    >
                      ပြန်ဖွင့်မည်
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 
        SINGLE PERMANENT MASTER YOUTUBE ENGINE
        There is ONLY ONE iframe in the entire app, mounted here at Root outside createPortal.
        - Its src (masterIframeSrc) ONLY changes when a new track ID is selected.
        - When in Pomodoro Focus, iframeWrapperRef positions itself directly over videoSlotRef.
        - When on Dashboard or any other tab, iframeWrapperRef hides off-screen without unmounting.
        - Therefore, switching tabs or returning to Pomodoro Focus NEVER restarts or stutters the song!
      */}
      <div
        ref={iframeWrapperRef}
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -50
        }}
        className="bg-black"
      >
        {masterIframeSrc && (
          <iframe
            ref={masterIframeRef}
            key={iframeConfig.youtubeId}
            onLoad={subscribeToYouTubeTelemetry}
            src={masterIframeSrc}
            title={activeTrack ? activeTrack.title : 'Study Audio Studio'}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      {/* Render Main Studio Panel (Portaled into Pomodoro or in-line if in workspace) */}
      {portalTarget
        ? createPortal(mainStudioContent, portalTarget)
        : isInPomodoroWorkspace
        ? mainStudioContent
        : null}

      {/* 3. ULTRA-SMOOTH DRAGGABLE FLOATING PIP PLAYER */}
      {isPipFloating && (
        <div
          ref={floatingPlayerRef}
          style={{
            right: `${position.x}px`,
            bottom: `${position.y}px`
          }}
          className={`fixed z-50 select-none ${
            isDragging
              ? 'transition-none shadow-2xl scale-[1.02]'
              : 'transition-transform duration-75 shadow-xl'
          } ${
            isCollapsed ? 'w-auto' : 'w-72 md:w-80'
          } bg-[#0c1324] border border-indigo-900/60 rounded-2xl backdrop-blur-md`}
        >
          {/* Header Bar */}
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            style={{ touchAction: 'none' }}
            className="p-2.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/70 rounded-t-2xl cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs">⋮⋮</span>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={() => {
                  if (onNavigateToPomodoroTab) onNavigateToPomodoroTab();
                }}
                className="px-2 py-0.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-800/60 hover:bg-rose-900 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>⏱️</span>
                <span>Pomodoro Tab ➔</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-slate-400 hover:text-white px-1.5 py-0.5 text-xs font-bold cursor-pointer"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                {isCollapsed ? '↗' : '—'}
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={() => setIsPipFloating(false)}
                className="text-slate-400 hover:text-rose-400 px-1 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Floating Body */}
          <div className={`p-3 space-y-2.5 ${isCollapsed ? 'hidden' : 'block'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate pr-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
                <span
                  className="text-xs font-bold text-slate-100 truncate"
                  title={activeTrack ? activeTrack.title : 'Idle'}
                >
                  {activeTrack ? activeTrack.title : 'ရွေးချယ်ထားသော သီချင်း မရှိသေးပါ'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowTimerMenu((prev) => !prev)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
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

            {/* Seekable Progress Bar & Real Time Indicator in Floating Player */}
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
              <div className="flex justify-between text-[10px] font-mono text-slate-400 px-0.5">
                <span>
                  ⏱️ {formatTime(currentTimeSec)} /{' '}
                  {durationSec > 0 ? formatTime(durationSec) : '--:--'}
                </span>
                <span className="text-[9px] text-slate-500">
                  {navSourceMode === 'queue'
                    ? '📑 Queue'
                    : navSourceMode === 'history'
                    ? '🕒 History'
                    : '⏮/⏭ Ask'}
                </span>
              </div>
            </div>

            {/* Queue vs History Navigation Chooser inside Floating Player */}
            {renderNavSourceChooser()}

            {/* Sleep Timer Drawer */}
            {showTimerMenu && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-2.5 text-xs shadow-lg">
                <div className="flex items-center justify-between text-slate-200 font-semibold pb-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span>⏱️ Sleep Timer</span>
                    {sleepTimerSeconds !== null && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-600/60 text-amber-300 font-mono text-[10px] font-bold">
                        {Math.floor(sleepTimerSeconds / 60)}:
                        {sleepTimerSeconds % 60 < 10 ? '0' : ''}
                        {sleepTimerSeconds % 60}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {sleepTimerSeconds !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setSleepTimerSeconds(null);
                          setSelectedTimerPreset(null);
                        }}
                        className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline font-bold cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowTimerMenu(false)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-[10px] font-bold border border-slate-700 cursor-pointer"
                      title="Sleep Timer မှ ထွက်မည်"
                    >
                      ✕ ပိတ်မည်
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[15, 30, 45, 60].map((m) => {
                    const isSelected =
                      selectedTimerPreset === m && sleepTimerSeconds !== null;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => selectSleepPreset(m)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-1 ring-indigo-400/60'
                            : 'bg-slate-900 hover:bg-indigo-950/80 hover:border-indigo-500/60 text-slate-200 border-slate-800'
                        }`}
                      >
                        {isSelected && <span>✓</span>}
                        <span>{m}m</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] text-slate-400">ချိန်ညှိမှု:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => reduceSleepTime(5)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-indigo-600 text-slate-200 text-[10px] font-bold border border-slate-800 cursor-pointer transition-all"
                    >
                      -5m
                    </button>
                    <button
                      type="button"
                      onClick={() => addSleepTime(5)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-indigo-600 text-slate-200 text-[10px] font-bold border border-slate-800 cursor-pointer transition-all"
                    >
                      +5m
                    </button>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-800/80 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setShowTimerMenu(false)}
                    className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      sleepTimerSeconds !== null
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {sleepTimerSeconds !== null ? (
                      <>
                        <span>✓</span>
                        <span>ရွေးချယ်ပြီး ထွက်မည် ({Math.ceil(sleepTimerSeconds / 60)} မိနစ်)</span>
                      </>
                    ) : (
                      <span>← Sleep Timer မှ ထွက်မည်</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between pt-1">
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
                  className="px-3.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400"
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

          {/* Collapsed View */}
          {isCollapsed && (
            <div
              onClick={() => setIsCollapsed(false)}
              className="px-3 py-1.5 text-xs text-slate-300 flex items-center gap-2 cursor-pointer hover:bg-slate-900 rounded-b-2xl"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span className="truncate max-w-[140px] text-[11px] font-semibold">
                {activeTrack ? activeTrack.title : 'Idle'}
              </span>
              <span className="text-[10px] font-mono text-cyan-400">
                ⏱️ {formatTime(currentTimeSec)}
              </span>
              <span className="text-cyan-400 text-[10px] font-bold ml-auto">Expand ↗</span>
            </div>
          )}
        </div>
      )}
    </>
  );
};
