import { useState } from "react";

export function useShakeWarning() {
  const [shakeTick, setShakeTick] = useState(0);
  const [overlayShakeTick, setOverlayShakeTick] = useState(0);

  const playWarningSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const t = ctx.currentTime;
      const createOsc = (freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.00001, t + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(t + 0.3);
      };
      createOsc(100);
      createOsc(106);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const triggerFieldShake = () => {
    setShakeTick(t => t + 1);
    playWarningSound();
  };

  const triggerOverlayShake = () => {
    setOverlayShakeTick(t => t + 1);
    playWarningSound();
  };

  return { shakeTick, overlayShakeTick, playWarningSound, triggerFieldShake, triggerOverlayShake };
}
