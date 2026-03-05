import { useEffect, useState, useRef } from 'react';
import { playSound } from '../lib/sounds';

interface TimerProps {
  durationMs: number;
  startedAt: number;
  onExpired?: () => void;
  label?: string;
}

const RING_SIZE = 96;
const STROKE_WIDTH = 4;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Timer({ durationMs, startedAt, onExpired, label }: TimerProps) {
  const [remaining, setRemaining] = useState(durationMs);
  const playedUrgentRef = useRef(false);

  useEffect(() => {
    playedUrgentRef.current = false;
  }, [startedAt]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const left = Math.max(0, durationMs - elapsed);
      setRemaining(left);

      const secs = Math.ceil(left / 1000);
      if (secs <= 10 && secs > 0 && !playedUrgentRef.current) {
        playedUrgentRef.current = true;
        playSound('timerUrgent');
      }

      if (left <= 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [durationMs, startedAt, onExpired]);

  const seconds = Math.ceil(remaining / 1000);
  const progress = remaining / durationMs;
  const urgent = seconds <= 10;
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-xs text-text-secondary max-w-[200px] text-center">{label}</span>}
      <div className={`relative w-24 h-24 ${urgent ? 'animate-pulse-glow' : ''}`}>
        <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={STROKE_WIDTH}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={urgent ? 'var(--color-team2)' : 'var(--color-accent)'}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 100ms, stroke 500ms' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-mono font-bold ${urgent ? 'text-team2' : 'text-text-primary'}`}>
            {seconds}s
          </span>
        </div>
      </div>
    </div>
  );
}
