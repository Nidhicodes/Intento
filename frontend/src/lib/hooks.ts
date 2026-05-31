'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number from 0 to target over `duration` ms using requestAnimationFrame.
 */
export function useCountUp(target: number, duration = 800, decimals = 0): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return decimals > 0 ? parseFloat(value.toFixed(decimals)) : Math.round(value);
}

/**
 * Cycles through an array of items, revealing them one at a time on an interval.
 * Returns the count of currently-visible items. Loops with a pause.
 */
export function useLogStream(total: number, intervalMs = 1500, pauseMs = 2000): number {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (visible < total) {
      timer = setTimeout(() => setVisible(v => v + 1), intervalMs);
    } else {
      timer = setTimeout(() => setVisible(0), pauseMs);
    }
    return () => clearTimeout(timer);
  }, [visible, total, intervalMs, pauseMs]);

  return visible;
}

/**
 * Copy to clipboard with a transient "copied" flag.
 */
export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return [copied, copy];
}

/**
 * Countdown timer from a number of seconds. Returns formatted "Xh Ym Zs".
 */
export function useCountdown(initialSeconds: number): string {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}
