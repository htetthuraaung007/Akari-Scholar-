/**
 * Audio Proofreading Utility using native Web Speech API
 * 100% Client-Side. No network dependencies or costs.
 */

export class AudioProofreader {
  private static synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  static speak(
    text: string,
    rate = 1.0,
    onBoundary?: (charIndex: number) => void,
    onEnd?: () => void
  ): boolean {
    if (!this.synth) return false;

    this.stop(); // Stop any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.0;

    // Pick a natural English voice if available
    const voices = this.synth.getVoices();
    const preferredVoice =
      voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    if (onBoundary) {
      utterance.onboundary = (e) => {
        if (e.name === 'word' || e.name === 'sentence') {
          onBoundary(e.charIndex);
        }
      };
    }

    utterance.onend = () => {
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
    return true;
  }

  static pause(): void {
    if (this.synth && this.synth.speaking) {
      this.synth.pause();
    }
  }

  static resume(): void {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  static stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }
}
