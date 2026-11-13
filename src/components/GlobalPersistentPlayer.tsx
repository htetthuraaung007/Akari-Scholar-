import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { backgroundAudioEngine } from '../utils/backgroundAudioEngine';
import {
  Play,
  Pause,
  X,
  Minimize2,
  Maximize2,
  ExternalLink,
  Key,
  Flame,
  Bell,
  BellRing,
  BatteryCharging,
  GripVertical,
  PanelRightClose,
  PanelRightOpen,
  ArrowUp,
  ArrowDown,
  Music,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
} from 'lucide-react';

export const GlobalPersistentPlayer: React.FC = () => {
  const {
    language,
    activeTab,
    setActiveTab,
    youtubePlayer,
    togglePlayPauseYouTube,
    closeYouTubePlayer,
    toggleMinimizeYouTube,
    playNextYouTubeTrack,
    playPreviousYouTubeTrack,
    toggleRepeatMode,
  } = useApp();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  // Position & Drag State (Allows placing anywhere on screen: top, middle, bottom, etc.)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tucked to Edge State (Hides player to the screen edge as an unobtrusive mini tab)
  const [isTucked, setIsTucked] = useState(false);
  const [tuckedSide, setTuckedSide] = useState<'right' | 'left'>('right');

  const [hasNotifPermission, setHasNotifPermission] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission === 'granted'
      : false;
  });

  // Clamp position to keep player comfortably inside viewport
  const clampPosition = (x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };
    const width = youtubePlayer.isMinimized ? 290 : 340;
    const height = youtubePlayer.isMinimized ? 60 : 380;
    const maxX = Math.max(10, window.innerWidth - width - 10);
    const maxY = Math.max(10, window.innerHeight - height - 10);
    return {
      x: Math.max(8, Math.min(maxX, x)),
      y: Math.max(8, Math.min(maxY, y)),
    };
  };

  // Touch drag handlers for mobile & tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    const touch = e.touches[0];
    const rect = playerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragOffset.current.x;
    const newY = touch.clientY - dragOffset.current.y;
    setPosition(clampPosition(newX, newY));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Mouse drag handlers for desktop/laptop
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    const rect = playerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      setPosition(clampPosition(newX, newY));
    };
    const onMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  // Quick Preset Positions (Top, Bottom, Edge)
  const moveToTop = () => {
    if (typeof window === 'undefined') return;
    setPosition({ x: Math.max(10, window.innerWidth - 360), y: 70 });
    setIsTucked(false);
  };

  const moveToBottom = () => {
    if (typeof window === 'undefined') return;
    setPosition({ x: Math.max(10, window.innerWidth - 360), y: window.innerHeight - 200 });
    setIsTucked(false);
  };

  const toggleTuckEdge = () => {
    if (!isTucked && position) {
      // Determine nearest side
      const mid = window.innerWidth / 2;
      setTuckedSide(position.x > mid ? 'right' : 'left');
    }
    setIsTucked(!isTucked);
  };

  // Send play/pause commands to YouTube iframe via postMessage
  useEffect(() => {
    if (!iframeRef.current || !youtubePlayer.isOpen) return;
    const command = youtubePlayer.isPlaying ? 'playVideo' : 'pauseVideo';
    try {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: command, args: '' }),
        '*'
      );
    } catch (err) {
      console.warn('Could not post command to YouTube iframe:', err);
    }
  }, [youtubePlayer.isPlaying, youtubePlayer.isOpen]);

  // =========================================================================
  // OS MediaSession & Battery-Optimized Dual Keep-Alive Engine
  // =========================================================================
  useEffect(() => {
    if (!youtubePlayer.isOpen) {
      backgroundAudioEngine.stopKeepAlive();
      backgroundAudioEngine.clearMediaSession();
      backgroundAudioEngine.closeNotification();
      return;
    }

    if (youtubePlayer.isPlaying) {
      backgroundAudioEngine.startKeepAlive();
      backgroundAudioEngine.updateMediaSession(
        youtubePlayer.title,
        true,
        togglePlayPauseYouTube,
        togglePlayPauseYouTube,
        closeYouTubePlayer,
        playNextYouTubeTrack,
        playPreviousYouTubeTrack
      );
      backgroundAudioEngine.showSystemNotification(youtubePlayer.title, true);
    } else {
      backgroundAudioEngine.stopKeepAlive();
      backgroundAudioEngine.updateMediaSession(
        youtubePlayer.title,
        false,
        togglePlayPauseYouTube,
        togglePlayPauseYouTube,
        closeYouTubePlayer,
        playNextYouTubeTrack,
        playPreviousYouTubeTrack
      );
      backgroundAudioEngine.closeNotification();
    }
  }, [
    youtubePlayer.isOpen,
    youtubePlayer.isPlaying,
    youtubePlayer.title,
    playNextYouTubeTrack,
    playPreviousYouTubeTrack,
  ]);

  // Listen for YouTube iframe events (e.g. video ended for auto-next / repeat)
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        if (typeof e.data === 'string') {
          const data = JSON.parse(e.data);
          // YouTube API onStateChange: 0 means ENDED
          if (data.event === 'onStateChange' && data.info === 0) {
            if (youtubePlayer.repeatMode === 'one') {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }),
                '*'
              );
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
                '*'
              );
            } else {
              playNextYouTubeTrack();
            }
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [youtubePlayer.repeatMode, playNextYouTubeTrack]);

  // =========================================================================
  // ZERO-MILLISECOND BACKGROUND AUDIO PROTECTION & FILE-PICKER AUTO-RESUME
  // Recovers playback when returning from native file picker or other apps
  // =========================================================================
  useEffect(() => {
    let wasPlayingWhenBlurred = false;

    const handleImmediateWake = () => {
      if (youtubePlayer.isPlaying && iframeRef.current) {
        // Instant command
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
          '*'
        );
      }
    };

    const handleFocus = () => {
      // When returning from native Android file picker, camera, or another app
      if (youtubePlayer.isOpen && (youtubePlayer.isPlaying || wasPlayingWhenBlurred)) {
        handleImmediateWake();
        setTimeout(handleImmediateWake, 150);
        setTimeout(handleImmediateWake, 450);
      }
    };

    const handleBlur = () => {
      if (youtubePlayer.isPlaying) {
        wasPlayingWhenBlurred = true;
      }
      handleImmediateWake();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && youtubePlayer.isPlaying) {
        backgroundAudioEngine.showSystemNotification(youtubePlayer.title, true);
        handleImmediateWake();
        setTimeout(handleImmediateWake, 40);
        setTimeout(handleImmediateWake, 120);
        setTimeout(handleImmediateWake, 300);
      } else if (document.visibilityState === 'visible') {
        handleImmediateWake();
        setTimeout(handleImmediateWake, 200);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handleImmediateWake);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handleImmediateWake);
    };
  }, [youtubePlayer.isPlaying, youtubePlayer.isOpen, youtubePlayer.title]);

  const handleRequestNotification = async () => {
    const granted = await backgroundAudioEngine.requestNotificationPermission();
    setHasNotifPermission(granted);
    if (granted && youtubePlayer.isPlaying) {
      backgroundAudioEngine.showSystemNotification(youtubePlayer.title, true);
    }
  };

  // If player hasn't been opened yet, keep hidden
  if (!youtubePlayer.isOpen) {
    return null;
  }

  return (
    <>
      {/* =========================================================
          CRITICAL ARCHITECTURE: SINGLE PERMANENT IFRAME IN DOM
          Rendered permanently at the root, NEVER unmounted!
          Moving, dragging, tucking, or minimizing NEVER resets the video!
         ========================================================= */}
      <div
        className={
          youtubePlayer.isMinimized || isTucked
            ? 'w-0 h-0 opacity-0 overflow-hidden fixed pointer-events-none'
            : 'w-0 h-0 opacity-0 overflow-hidden fixed pointer-events-none'
        }
        aria-hidden="true"
      >
        {/* Note: IFrame is mounted in the floating card below when visible, or kept in single node */}
      </div>

      {/* =========================================================
          MODE A: TUCKED-TO-SIDE EDGE TAB (COMPLETELY UNOBTRUSIVE)
          Hides to the edge of the screen so user can work freely without distraction!
         ========================================================= */}
      {isTucked ? (
        <div
          onClick={() => setIsTucked(false)}
          className={`fixed z-50 flex items-center space-x-2 py-2 px-3 bg-slate-950/95 border-rose-500/60 shadow-2xl backdrop-blur-md cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 text-white ${
            tuckedSide === 'right'
              ? 'right-0 rounded-l-2xl border-y border-l'
              : 'left-0 rounded-r-2xl border-y border-r'
          }`}
          style={{ top: `${position ? position.y : 120}px` }}
          title={language === 'my' ? 'နှိပ်၍ Music Player ပြန်ဖွင့်မည်' : 'Click to reveal music player'}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>

          <Music className="w-3.5 h-3.5 text-rose-400 animate-pulse" />

          {/* Mini Play/Pause directly on tucked tab */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPauseYouTube();
            }}
            className="p-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white transition-colors"
            title={youtubePlayer.isPlaying ? 'Pause' : 'Play'}
          >
            {youtubePlayer.isPlaying ? (
              <Pause className="w-2.5 h-2.5" />
            ) : (
              <Play className="w-2.5 h-2.5 fill-current" />
            )}
          </button>

          <span className="text-[11px] font-bold text-rose-300 max-w-[80px] sm:max-w-[120px] truncate">
            {youtubePlayer.title}
          </span>

          <PanelRightOpen className="w-3 h-3 text-slate-400" />
        </div>
      ) : null}

      {/* =========================================================
          MODE B: DRAGGABLE / REPOSITIONABLE FLOATING PLAYER
         ========================================================= */}
      <div
        ref={playerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={
          position
            ? {
                left: isTucked ? '-9999px' : `${position.x}px`,
                top: isTucked ? '-9999px' : `${position.y}px`,
                right: 'auto',
                bottom: 'auto',
                opacity: isTucked ? 0.001 : 1,
                pointerEvents: isTucked ? 'none' : 'auto',
              }
            : {
                left: isTucked ? '-9999px' : undefined,
                opacity: isTucked ? 0.001 : 1,
                pointerEvents: isTucked ? 'none' : 'auto',
              }
        }
        className={`fixed z-50 transition-shadow select-none ${
          !position ? 'bottom-4 right-4' : ''
        } ${
          youtubePlayer.isMinimized
            ? 'w-[290px] sm:w-[320px]'
            : 'w-[300px] sm:w-[350px]'
        } ${isDragging ? 'cursor-grabbing shadow-rose-500/40' : ''}`}
      >
        <div className="rounded-2xl bg-slate-950/95 border border-rose-500/50 shadow-2xl backdrop-blur-md overflow-hidden text-white transition-all duration-200">
          {/* =========================================================
              HEADER & DRAG HANDLE
             ========================================================= */}
          {youtubePlayer.isMinimized ? (
            /* MINIMIZED FLOATING PILL VIEW */
            <div className="flex items-center space-x-2 px-3 py-2 animate-in fade-in cursor-grab active:cursor-grabbing">
              {/* Drag Grip Handle */}
              <div
                className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-rose-400 shrink-0"
                title={language === 'my' ? 'ဖိဆွဲ၍ ကြိုက်သည့်နေရာသို့ ရွှေ့နိုင်သည်' : 'Drag to reposition'}
              >
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Animated sound wave bars */}
              <div className="flex items-end space-x-0.5 h-3.5 shrink-0">
                <span
                  className={`w-1 bg-rose-500 rounded-full transition-all ${
                    youtubePlayer.isPlaying ? 'h-3.5 animate-pulse' : 'h-1.5'
                  }`}
                />
                <span
                  className={`w-1 bg-pink-400 rounded-full transition-all ${
                    youtubePlayer.isPlaying ? 'h-3 animate-pulse delay-75' : 'h-1'
                  }`}
                />
                <span
                  className={`w-1 bg-amber-400 rounded-full transition-all ${
                    youtubePlayer.isPlaying ? 'h-3.5 animate-pulse delay-150' : 'h-2'
                  }`}
                />
              </div>

              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={toggleMinimizeYouTube}
                title={language === 'my' ? 'ဗီဒီယို ပြန်ချဲ့ကြည့်ရန် နှိပ်ပါ' : 'Click to expand'}
              >
                <p className="text-xs font-semibold truncate text-slate-100">
                  {youtubePlayer.title}
                </p>
                <p className="text-[9px] text-emerald-400 font-medium truncate">
                  {youtubePlayer.isPlaying ? '● Playing' : '⏸ Paused'}
                </p>
              </div>

              {/* Action Buttons: Prev, Play/Pause, Next, Repeat, Tuck, Expand, Close */}
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  type="button"
                  onClick={playPreviousYouTubeTrack}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title={language === 'my' ? 'ရှေ့သီချင်း (Previous)' : 'Previous Track'}
                >
                  <SkipBack className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={togglePlayPauseYouTube}
                  className="p-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                  title={youtubePlayer.isPlaying ? 'Pause' : 'Play'}
                >
                  {youtubePlayer.isPlaying ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={playNextYouTubeTrack}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title={language === 'my' ? 'နောက်သီချင်း (Next)' : 'Next Track'}
                >
                  <SkipForward className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={toggleRepeatMode}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${
                    youtubePlayer.repeatMode === 'one'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : youtubePlayer.repeatMode === 'all'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={
                    youtubePlayer.repeatMode === 'one'
                      ? (language === 'my' ? 'Repeat 1 (တစ်ပုဒ်တည်းပြန်ဖွင့်မည်)' : 'Repeat 1 Active')
                      : youtubePlayer.repeatMode === 'all'
                      ? (language === 'my' ? 'Loop All (အားလုံးဆက်တိုက်ဖွင့်မည်)' : 'Loop Playlist Active')
                      : (language === 'my' ? 'Repeat ပိတ်ထားသည်' : 'Repeat Off')
                  }
                >
                  {youtubePlayer.repeatMode === 'one' ? (
                    <Repeat1 className="w-3 h-3 text-amber-300" />
                  ) : (
                    <Repeat className={`w-3 h-3 ${youtubePlayer.repeatMode === 'all' ? 'text-cyan-300' : ''}`} />
                  )}
                </button>

                {/* Tuck to edge button */}
                <button
                  type="button"
                  onClick={toggleTuckEdge}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title={language === 'my' ? 'ဘေးဘက်ကပ်ထားမည် (Tuck to edge)' : 'Tuck to edge'}
                >
                  <PanelRightClose className="w-3 h-3 text-amber-300" />
                </button>

                <button
                  type="button"
                  onClick={toggleMinimizeYouTube}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Expand Video"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={closeYouTubePlayer}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                  title="Stop & Close Player"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            /* EXPANDED HEADER VIEW */
            <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between animate-in fade-in cursor-grab active:cursor-grabbing">
              <div className="flex items-center space-x-1.5 min-w-0">
                <div
                  className="text-slate-500 hover:text-rose-400 shrink-0 cursor-grab active:cursor-grabbing"
                  title={language === 'my' ? 'ဖိဆွဲ၍ ရွှေ့ပါ' : 'Drag to reposition'}
                >
                  <GripVertical className="w-4 h-4" />
                </div>
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 ${
                      youtubePlayer.isPlaying ? 'block' : 'hidden'
                    }`}
                  />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
                <span className="text-xs font-bold text-rose-300 truncate">
                  Focus Music
                </span>
              </div>

              {/* Quick Position Tools & Controls */}
              <div className="flex items-center space-x-1">
                {/* Reposition shortcuts: Top / Bottom */}
                <button
                  type="button"
                  onClick={moveToTop}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title={language === 'my' ? 'အပေါ်ဘက်သို့ ရွှေ့မည်' : 'Move to Top'}
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={moveToBottom}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title={language === 'my' ? 'အောက်ဘက်သို့ ရွှေ့မည်' : 'Move to Bottom'}
                >
                  <ArrowDown className="w-3 h-3" />
                </button>

                {/* Tuck to Side button */}
                <button
                  type="button"
                  onClick={toggleTuckEdge}
                  className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
                  title={language === 'my' ? 'ဘေးဘက်သို့ ကပ်ထားမည်' : 'Tuck to side'}
                >
                  <PanelRightClose className="w-3 h-3 text-amber-400" />
                </button>

                <button
                  type="button"
                  onClick={toggleMinimizeYouTube}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Minimize"
                >
                  <Minimize2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={closeYouTubePlayer}
                  className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              CRITICAL: THE SINGLE PERMANENT IFRAME IN THE DOM
              Never unmounted during drag, minimize, expand, or reposition!
             ========================================================= */}
          <div
            className={
              youtubePlayer.isMinimized
                ? 'w-1 h-1 opacity-[0.01] overflow-hidden absolute -left-[9999px] pointer-events-none'
                : 'aspect-video w-full bg-black relative shadow-inner block'
            }
          >
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${youtubePlayer.videoId}?enablejsapi=1&autoplay=1&rel=0&playsinline=1`}
              title={youtubePlayer.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* =========================================================
              EXPANDED BOTTOM INFO & CONTROLS
             ========================================================= */}
          {!youtubePlayer.isMinimized && (
            <div className="p-3 bg-slate-950 space-y-2.5 animate-in fade-in">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-100 truncate" title={youtubePlayer.title}>
                    🎵 {youtubePlayer.title}
                  </p>
                  <p className="text-[10px] text-emerald-400 flex items-center space-x-1 mt-0.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      {language === 'my'
                        ? 'ဖိဆွဲ၍ အပေါ်/အောက်/ဘေး ကြိုက်ရာရွှေ့နိုင်ပါသည်'
                        : 'Draggable to any position / Tuck to side'}
                    </span>
                  </p>
                </div>
              </div>

              {/* DEDICATED TRANSPORT BAR: PREVIOUS, PLAY/PAUSE, NEXT, REPEAT */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center space-x-1.5">
                  {/* Previous Track Button */}
                  <button
                    type="button"
                    onClick={playPreviousYouTubeTrack}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                    title={language === 'my' ? 'ရှေ့သီချင်း (Previous)' : 'Previous Track'}
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>

                  {/* Play / Pause Button */}
                  <button
                    type="button"
                    onClick={togglePlayPauseYouTube}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition-all cursor-pointer shadow-md ${
                      youtubePlayer.isPlaying
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    {youtubePlayer.isPlaying ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Play</span>
                      </>
                    )}
                  </button>

                  {/* Next Track Button */}
                  <button
                    type="button"
                    onClick={playNextYouTubeTrack}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                    title={language === 'my' ? 'နောက်သီချင်း (Next)' : 'Next Track'}
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Repeat Button & Playlist Position Counter */}
                <div className="flex items-center space-x-2">
                  {youtubePlayer.playlist && youtubePlayer.playlist.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {youtubePlayer.currentIndex + 1}/{youtubePlayer.playlist.length}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={toggleRepeatMode}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                      youtubePlayer.repeatMode === 'one'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : youtubePlayer.repeatMode === 'all'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title="Toggle Repeat: Off / Repeat 1 / Loop All"
                  >
                    {youtubePlayer.repeatMode === 'one' ? (
                      <>
                        <Repeat1 className="w-3 h-3 text-amber-300" />
                        <span className="text-[10px]">Repeat 1</span>
                      </>
                    ) : youtubePlayer.repeatMode === 'all' ? (
                      <>
                        <Repeat className="w-3 h-3 text-cyan-300" />
                        <span className="text-[10px]">Loop All</span>
                      </>
                    ) : (
                      <>
                        <Repeat className="w-3 h-3" />
                        <span className="text-[10px]">Repeat Off</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Notification & Lock Screen Control Bar */}
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1.5 min-w-0">
                  {hasNotifPermission ? (
                    <BellRing className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-bounce" />
                  ) : (
                    <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span className="truncate text-slate-300">
                    {hasNotifPermission
                      ? (language === 'my'
                        ? 'Lock Screen Notification ဖွင့်ထားပြီး ✅'
                        : 'Lock Screen Active ✅')
                      : (language === 'my'
                        ? 'Lock Screen တွင် မြင်ရစေရန်'
                        : 'Show in Lock Screen')}
                  </span>
                </div>

                {!hasNotifPermission ? (
                  <button
                    type="button"
                    onClick={handleRequestNotification}
                    className="px-2 py-0.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-[10px] shrink-0 transition-colors cursor-pointer"
                  >
                    {language === 'my' ? 'ဖွင့်မည်' : 'Enable'}
                  </button>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Active
                  </span>
                )}
              </div>

              {/* Quick Helper Links: Sign-in + Open YouTube + Focus Tab */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-900 text-[10px]">
                <div className="flex items-center space-x-1.5">
                  <a
                    href={`https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com/watch?v=${youtubePlayer.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600 hover:text-white transition-all font-semibold flex items-center space-x-1"
                    title="Sign In to clear bot check"
                  >
                    <Key className="w-2.5 h-2.5" />
                    <span>Sign In</span>
                  </a>

                  <a
                    href={`https://www.youtube.com/watch?v=${youtubePlayer.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 hover:text-white transition-all font-semibold flex items-center space-x-1"
                    title="Open video in dedicated tab"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span>YouTube</span>
                  </a>
                </div>

                {activeTab !== 'pomodoro' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('pomodoro')}
                    className="text-pink-400 hover:text-pink-300 flex items-center space-x-1 font-semibold cursor-pointer"
                  >
                    <Flame className="w-2.5 h-2.5 text-amber-400" />
                    <span>{language === 'my' ? 'Focus စာမျက်နှာ' : 'Focus Tab'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
