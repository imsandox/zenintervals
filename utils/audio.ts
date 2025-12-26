
/**
 * Shared AudioContext to be reused and unlocked.
 */
let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!sharedAudioCtx) {
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    sharedAudioCtx = new AudioContextClass();
  }
  return sharedAudioCtx;
};

/**
 * Android/iOS browsers require a user gesture to resume the AudioContext.
 * This should be called in the onClick handler of the Start button.
 */
export const unlockAudioContext = () => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
};

/**
 * Generates a gentle "Singing Bowl" or "Soft Chime" sound using Web Audio API.
 */
export const playGentleChime = () => {
  const audioCtx = getAudioContext();
  
  const playTone = (freq: number, startTime: number, duration: number, volume: number) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, startTime);
    
    // Envelope: Gentle attack and long release
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };

  const now = audioCtx.currentTime;
  // Harmonic series for a bowl-like sound
  playTone(220, now, 4, 0.4);      // Root
  playTone(440, now + 0.05, 3.5, 0.2); // Octave
  playTone(659.25, now + 0.1, 3, 0.1); // Fifth
  playTone(880, now + 0.15, 2.5, 0.05); // High Octave
};

export const playFinishedChime = () => {
  const audioCtx = getAudioContext();
  
  const now = audioCtx.currentTime;
  const playTone = (freq: number, delay: number) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.3, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 1.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 1.5);
  };

  playTone(523.25, 0);   // C5
  playTone(659.25, 0.2); // E5
  playTone(783.99, 0.4); // G5
};
