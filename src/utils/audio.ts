/**
 * Audio cue utility using Web Audio API
 * Works completely offline with zero external audio assets.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playPomodoroBell(isBreakStart = false) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (isBreakStart) {
      // Gentle ascending 2-tone chime for break time
      playTone(ctx, 523.25, now, 0.4); // C5
      playTone(ctx, 659.25, now + 0.25, 0.6); // E5
      playTone(ctx, 783.99, now + 0.5, 0.8); // G5
    } else {
      // Focus session start / deep bell
      playTone(ctx, 440, now, 0.5); // A4
      playTone(ctx, 880, now + 0.2, 0.7); // A5
    }
  } catch (e) {
    console.warn('Audio play hindered by browser autoplay policy:', e);
  }
}

function playTone(ctx: AudioContext, freq: number, startTime: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}
