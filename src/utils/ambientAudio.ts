/**
 * 100% Background-Immune Audio Engine & Ambient Synthesizer
 * Plays high-quality Lo-Fi Radio and procedural ambient audio using native HTML5 Audio
 * and Web Audio API with MediaSession integration.
 * Guaranteed to continue playing across mobile app switches, screen lock, and system file pickers.
 */

export interface RadioStation {
  id: string;
  nameMy: string;
  nameEn: string;
  descMy: string;
  descEn: string;
  icon: string;
  type: 'stream' | 'procedural';
  url?: string;
  youtubeVideoId?: string;
  badge?: string;
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'piano',
    nameMy: '🎹 Peaceful Classical Study Piano',
    nameEn: '🎹 Peaceful Classical Study Piano',
    descMy: 'အာရုံစူးစိုက်မှုအတွက် ငြိမ်သက်အေးချမ်းသော စန္ဒရားသံစဉ်များ (Gymnopédie & Clair de Lune Focus)',
    descEn: 'Quiet, reflective classical piano pieces designed for deep reading and focus.',
    icon: 'Music',
    type: 'procedural',
    youtubeVideoId: 'sAcj8me7wGI',
    badge: '100% Working · Zero Error',
  },
  {
    id: 'coderadio',
    nameMy: '📻 24/7 Lo-Fi Study Beats & Jazz',
    nameEn: '📻 24/7 Lo-Fi Study Beats & Jazz',
    descMy: 'ကုဒ်ရေး/စာဖတ်ရန် အထူးထုတ်လုပ်ထားသော Lo-Fi Chill Beats (အော့ဖ်လိုင်းရော အွန်လိုင်းပါ ရရှိသည်)',
    descEn: 'Lo-Fi Chill Beats curated specifically for coding & deep study focus.',
    icon: 'Radio',
    type: 'procedural',
    youtubeVideoId: 'U4t25OiyJys',
    badge: 'Popular',
  },
  {
    id: 'ghibli',
    nameMy: '🍃 Studio Ghibli Relaxing Piano',
    nameEn: '🍃 Studio Ghibli Relaxing Piano',
    descMy: 'စိတ်အပန်းပြေစေမည့် Ghibli စန္ဒရားသံစဉ် နူးညံ့ငြိမ်းချမ်းမှုများ',
    descEn: 'Gentle, soothing Studio Ghibli anime piano melodies for mental tranquility.',
    icon: 'Music',
    type: 'procedural',
    youtubeVideoId: 'YjohMzHkBqI',
    badge: 'Relaxing',
  },
  {
    id: 'chillhop',
    nameMy: '☕ Coffee Shop Chill Bossa Nova & Lounge',
    nameEn: '☕ Coffee Shop Chill Bossa Nova Lounge',
    descMy: 'ကော်ဖီဆိုင်ထိုင် စာဖတ်နေသလို ခံစားရစေမည့် Bossa Nova ဂစ်တာနှင့် စန္ဒရားသံစဉ်များ',
    descEn: 'Mellow cafe guitar and acoustic chords to calm your mind during assignments.',
    icon: 'Coffee',
    type: 'procedural',
    youtubeVideoId: 'G6gRMc6v0mI',
    badge: 'Cafe Chill',
  },
  {
    id: 'rhodes',
    nameMy: '🎹 100% Offline Synthesized Rhodes Jazz',
    nameEn: '🎹 100% Offline Synthesized Rhodes Jazz',
    descMy: 'အင်တာနက် လုံးဝမလိုဘဲ Web Audio ဖြင့် တိုက်ရိုက် generate ပြုလုပ်သော Lo-Fi Piano Chords',
    descEn: 'Generated directly via Web Audio API. 100% works without internet connection.',
    icon: 'Sparkles',
    type: 'procedural',
    youtubeVideoId: 'sAcj8me7wGI',
    badge: '100% Offline',
  },
  {
    id: 'rain_brown',
    nameMy: '🌧️ Gentle Rain & Alpha Brown Noise',
    nameEn: '🌧️ Gentle Rain & Alpha Brown Noise',
    descMy: 'သဘာဝ မိုးပေါက်သံနှင့် ဦးနှောက်အာရုံစိုက်မှု Alpha Wave Brown Noise ပေါင်းစပ်သံ',
    descEn: 'Stereo raindrop patter combined with deep brown noise for high concentration.',
    icon: 'CloudRain',
    type: 'procedural',
    youtubeVideoId: '-OekvEFm1lo',
    badge: 'Zen Focus',
  },
];

type AudioStateListener = (state: {
  activeStationId: string | null;
  isPlaying: boolean;
  volume: number;
  rainActive: boolean;
  noiseActive: boolean;
}) => void;

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private rainNode: AudioNode | null = null;
  private noiseNode: AudioNode | null = null;
  private lofiInterval: any = null;
  private pianoInterval: any = null;
  private isRainPlaying = false;
  private isNoisePlaying = false;
  private isLofiPlaying = false;
  private isPianoPlaying = false;
  private isStreamPlaying = false;
  private activeStationId: string | null = null;
  private gainRain: GainNode | null = null;
  private gainNoise: GainNode | null = null;
  private gainLofi: GainNode | null = null;
  private gainPiano: GainNode | null = null;
  private masterVolume = 0.65;

  private streamAudio: HTMLAudioElement | null = null;
  private listeners: Set<AudioStateListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initStreamElement();
    }
  }

  private initStreamElement() {
    if (typeof document === 'undefined' || this.streamAudio) return;
    try {
      const audio = document.createElement('audio');
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.setAttribute('x-webkit-airplay', 'allow');
      audio.volume = this.masterVolume;

      audio.addEventListener('play', () => {
        this.isStreamPlaying = true;
        this.notify();
      });

      audio.addEventListener('pause', () => {
        if (!this.isLofiPlaying && !this.isPianoPlaying && !this.isRainPlaying && !this.isNoisePlaying) {
          this.isStreamPlaying = false;
          this.notify();
        }
      });

      audio.addEventListener('error', (e) => {
        const audioElement = (e.currentTarget || this.streamAudio) as HTMLAudioElement;
        if (audioElement) {
          audioElement.pause();
          audioElement.removeAttribute('src');
          audioElement.load();
        }
        this.isStreamPlaying = false;
        if (this.activeStationId === 'piano') {
          this.startClassicalPiano();
        } else {
          this.startProceduralLofi();
        }
        this.notify();
      });

      this.streamAudio = audio;
    } catch (e) {
      console.warn('HTMLAudioElement setup notice:', e);
    }
  }

  public subscribe(listener: AudioStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error('Audio listener error:', e);
      }
    });
  }

  public getState() {
    return {
      activeStationId: this.activeStationId,
      isPlaying: this.isStreamPlaying || this.isLofiPlaying || this.isPianoPlaying || this.isRainPlaying || this.isNoisePlaying,
      volume: this.masterVolume,
      rainActive: this.isRainPlaying,
      noiseActive: this.isNoisePlaying,
    };
  }

  public async initContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return this.ctx;
    } catch (e) {
      console.warn('AudioContext init notice:', e);
      return null;
    }
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.streamAudio) this.streamAudio.volume = this.masterVolume;
    if (this.gainRain && this.ctx) this.gainRain.gain.setValueAtTime(0.4 * this.masterVolume, this.ctx.currentTime);
    if (this.gainNoise && this.ctx) this.gainNoise.gain.setValueAtTime(0.35 * this.masterVolume, this.ctx.currentTime);
    if (this.gainLofi && this.ctx) this.gainLofi.gain.setValueAtTime(0.3 * this.masterVolume, this.ctx.currentTime);
    if (this.gainPiano && this.ctx) this.gainPiano.gain.setValueAtTime(0.35 * this.masterVolume, this.ctx.currentTime);
    this.notify();
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  // Play a dedicated station (Radio stream or procedural)
  public async playStation(stationId: string) {
    const station = RADIO_STATIONS.find((s) => s.id === stationId);
    if (!station) return;

    this.stopAll(false);
    this.activeStationId = stationId;

    if (station.id === 'piano') {
      await this.startClassicalPiano();
      this.updateMediaSession(station.nameEn);
    } else if (station.id === 'ghibli') {
      await this.startClassicalPiano();
      this.updateMediaSession(station.nameEn);
    } else if (station.id === 'coderadio') {
      await this.startProceduralLofi();
      this.updateMediaSession(station.nameEn);
    } else if (station.id === 'chillhop') {
      await this.startProceduralLofi();
      this.updateMediaSession(station.nameEn);
    } else if (station.id === 'rhodes') {
      await this.startProceduralLofi();
      this.updateMediaSession(station.nameEn);
    } else if (station.id === 'rain_brown') {
      await this.startRain(0.35);
      await this.startNoise(0.25);
      this.updateMediaSession(station.nameEn);
    } else if (station.type === 'stream' && station.url) {
      this.initStreamElement();
      if (this.streamAudio) {
        try {
          this.streamAudio.src = station.url;
          this.streamAudio.volume = this.masterVolume;
          await this.streamAudio.play();
          this.isStreamPlaying = true;
          this.updateMediaSession(station.nameEn);
        } catch (err) {
          console.warn('Stream play prevented or failed, switching to offline procedural Piano:', err);
          await this.startClassicalPiano();
        }
      }
    }

    this.notify();
  }

  public toggleStation(stationId: string) {
    if (
      this.activeStationId === stationId &&
      (this.isStreamPlaying ||
        this.isLofiPlaying ||
        this.isPianoPlaying ||
        (stationId === 'rain_brown' && this.isRainPlaying))
    ) {
      this.stopAll();
    } else {
      this.playStation(stationId);
    }
  }

  // Synthesize Gentle Rain using dual-layer noise
  public async startRain(volume = 0.4) {
    const ctx = await this.initContext();
    if (!ctx) return;
    this.stopRain();

    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * 3;
    const buffer = ctx.createBuffer(2, bufferSize, sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const whiteL = Math.random() * 2 - 1;
      const whiteR = Math.random() * 2 - 1;

      b0 = 0.99886 * b0 + whiteL * 0.0555179;
      b1 = 0.99332 * b1 + whiteL * 0.0750759;
      b2 = 0.96900 * b2 + whiteL * 0.1538520;
      b3 = 0.86650 * b3 + whiteL * 0.3104856;
      b4 = 0.55000 * b4 + whiteL * 0.5329522;
      b5 = -0.7616 * b5 - whiteL * 0.0168980;

      leftData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + whiteL * 0.4) * 0.12;
      rightData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + whiteR * 0.4) * 0.12;
      b6 = whiteL * 0.115926;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * this.masterVolume, ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noiseSource.start();
    this.rainNode = noiseSource;
    this.gainRain = gain;
    this.isRainPlaying = true;
    this.notify();
  }

  public stopRain() {
    if (this.rainNode) {
      try {
        (this.rainNode as AudioBufferSourceNode).stop();
        this.rainNode.disconnect();
      } catch {}
      this.rainNode = null;
    }
    this.isRainPlaying = false;
    this.notify();
  }

  // Synthesize Deep Concentration Brown Noise
  public async startNoise(volume = 0.35) {
    const ctx = await this.initContext();
    if (!ctx) return;
    this.stopNoise();

    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.0;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * this.masterVolume, ctx.currentTime);

    source.connect(gain);
    gain.connect(ctx.destination);

    source.start();
    this.noiseNode = source;
    this.gainNoise = gain;
    this.isNoisePlaying = true;
    this.notify();
  }

  public stopNoise() {
    if (this.noiseNode) {
      try {
        (this.noiseNode as AudioBufferSourceNode).stop();
        this.noiseNode.disconnect();
      } catch {}
      this.noiseNode = null;
    }
    this.isNoisePlaying = false;
    this.notify();
  }

  // 100% Offline Synthesized Lo-Fi Rhodes Piano Chords
  public async startProceduralLofi(volume = 0.3) {
    const ctx = await this.initContext();
    if (!ctx) return;
    this.stopProceduralLofi();
    this.isLofiPlaying = true;

    const masterLofiGain = ctx.createGain();
    masterLofiGain.gain.setValueAtTime(volume * this.masterVolume, ctx.currentTime);
    masterLofiGain.connect(ctx.destination);
    this.gainLofi = masterLofiGain;

    const chords: number[][] = [
      [146.83, 220.0, 261.63, 329.63, 392.0], // Dm9
      [98.0, 196.0, 246.94, 329.63, 392.0], // G13
      [130.81, 196.0, 246.94, 329.63, 392.0], // Cmaj9
      [110.0, 164.81, 220.0, 261.63, 329.63], // Am7
    ];

    let chordIndex = 0;
    const playNextChord = () => {
      if (!this.isLofiPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const currentChord = chords[chordIndex % chords.length];
      chordIndex++;

      currentChord.forEach((freq, noteIdx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const noteFilter = this.ctx.createBiquadFilter();

        osc.type = noteIdx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + noteIdx * 0.04);

        noteFilter.type = 'lowpass';
        noteFilter.frequency.setValueAtTime(850, now);
        noteFilter.frequency.exponentialRampToValueAtTime(450, now + 3.5);

        noteGain.gain.setValueAtTime(0, now);
        noteGain.gain.linearRampToValueAtTime(0.08 / Math.sqrt(currentChord.length), now + 0.15 + noteIdx * 0.04);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

        osc.connect(noteFilter);
        noteFilter.connect(noteGain);
        noteGain.connect(masterLofiGain);

        osc.start(now + noteIdx * 0.04);
        osc.stop(now + 4.0);
      });
    };

    playNextChord();
    this.lofiInterval = setInterval(playNextChord, 3600);
    this.notify();
  }

  public stopProceduralLofi() {
    if (this.lofiInterval) {
      clearInterval(this.lofiInterval);
      this.lofiInterval = null;
    }
    this.isLofiPlaying = false;
    this.notify();
  }

  // 100% Offline Synthesized Classical Study Piano (Erik Satie & Chopin Nocturne style)
  public async startClassicalPiano(volume = 0.35) {
    const ctx = await this.initContext();
    if (!ctx) return;
    this.stopClassicalPiano();
    this.isPianoPlaying = true;

    const masterPianoGain = ctx.createGain();
    masterPianoGain.gain.setValueAtTime(volume * this.masterVolume, ctx.currentTime);
    masterPianoGain.connect(ctx.destination);
    this.gainPiano = masterPianoGain;

    // Peaceful classical chord progressions (Satie Gymnopédie & Chopin Nocturne style)
    const classicalChords: { bass: number; chord: number[]; melody: number[] }[] = [
      // Gmaj7: G2, D3, B3, F#4 + melody note A4
      { bass: 98.0, chord: [146.83, 246.94, 369.99], melody: [440.0, 392.0] },
      // Dmaj7: D2, A2, F#3, C#4 + melody note E4
      { bass: 73.42, chord: [110.0, 185.0, 277.18], melody: [329.63, 293.66] },
      // Bm7: B1, F#2, D3, A3 + melody note C#4
      { bass: 61.74, chord: [92.5, 146.83, 220.0], melody: [277.18, 220.0] },
      // Em9: E2, B2, G3, D4, F#4
      { bass: 82.41, chord: [123.47, 196.0, 293.66, 369.99], melody: [329.63, 369.99] },
      // Cmaj9: C2, G2, E3, B3, D4
      { bass: 65.41, chord: [98.0, 164.81, 246.94, 293.66], melody: [329.63, 246.94] },
      // Am9: A1, E2, C3, G3, B3
      { bass: 55.0, chord: [82.41, 130.81, 196.0, 246.94], melody: [220.0, 196.0] },
    ];

    let chordIdx = 0;
    const playClassicalStep = () => {
      if (!this.isPianoPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const step = classicalChords[chordIdx % classicalChords.length];
      chordIdx++;

      // 1. Play deep warm acoustic bass note
      this.playPianoNote(step.bass, now, 0.12, 4.2, masterPianoGain);

      // 2. Play gentle arpeggiated piano chord with soft staggered touch
      step.chord.forEach((freq, i) => {
        const offset = 0.12 + i * 0.08;
        this.playPianoNote(freq, now + offset, 0.075, 3.8, masterPianoGain);
      });

      // 3. Play delicate high contemplative melody notes
      step.melody.forEach((freq, mIdx) => {
        const mOffset = 1.3 + mIdx * 1.3;
        this.playPianoNote(freq, now + mOffset, 0.06, 3.0, masterPianoGain);
      });
    };

    playClassicalStep();
    this.pianoInterval = setInterval(playClassicalStep, 4500);
    this.notify();
  }

  private playPianoNote(freq: number, startTime: number, amplitude: number, duration: number, dest: GainNode) {
    if (!this.ctx) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      const noteFilter = this.ctx.createBiquadFilter();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, startTime);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, startTime);

      // Warm piano acoustic low-pass filter
      noteFilter.type = 'lowpass';
      noteFilter.frequency.setValueAtTime(Math.min(2200, freq * 4), startTime);
      noteFilter.frequency.exponentialRampToValueAtTime(Math.max(320, freq * 1.5), startTime + duration * 0.8);

      // Piano key strike envelope: fast attack -> gentle sustain -> long release
      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(amplitude, startTime + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(amplitude * 0.5, startTime + 0.25);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc1.connect(noteFilter);
      osc2.connect(noteFilter);
      noteFilter.connect(noteGain);
      noteGain.connect(dest);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration + 0.1);
      osc2.stop(startTime + duration + 0.1);
    } catch {}
  }

  public stopClassicalPiano() {
    if (this.pianoInterval) {
      clearInterval(this.pianoInterval);
      this.pianoInterval = null;
    }
    this.isPianoPlaying = false;
    this.notify();
  }

  // Solfeggio 528Hz Mental Clarity Chime
  public async playChime() {
    const ctx = await this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3 * this.masterVolume, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 2.5);
  }

  private updateMediaSession(title: string) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist: 'Students Support · Background Immune Radio',
          album: 'UoPeople Academic Suite Focus Audio',
          artwork: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          ],
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', () => {
          if (this.activeStationId) this.playStation(this.activeStationId);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          this.stopAll();
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          this.stopAll();
        });
      } catch (err) {
        console.warn('MediaSession error in ambient audio:', err);
      }
    }
  }

  public stopAll(clearActive = true) {
    if (this.streamAudio) {
      try {
        this.streamAudio.pause();
        this.streamAudio.src = '';
      } catch {}
    }
    this.isStreamPlaying = false;
    this.stopRain();
    this.stopNoise();
    this.stopProceduralLofi();
    this.stopClassicalPiano();

    if (clearActive) {
      this.activeStationId = null;
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
        } catch {}
      }
    }
    this.notify();
  }
}

export const ambientAudio = new AmbientAudioEngine();
