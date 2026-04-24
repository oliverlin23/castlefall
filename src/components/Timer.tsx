import { useEffect, useState, useRef } from 'react';
import { playSound } from '../lib/sounds';
import { HourglassSprite } from './sprites';

interface TimerProps {
  durationMs: number;
  startedAt: number;
  onExpired?: () => void;
  label?: string;
}

const RING_SIZE = 104;
const STROKE_WIDTH = 3;
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
      {label && (
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--color-ink-mid)] max-w-[240px] text-center">
          {label}
        </span>
      )}
      <div className={`relative w-[104px] h-[104px] ${urgent ? 'animate-flicker' : ''}`}>
        <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-ink-soft)"
            strokeOpacity="0.4"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray="2 2"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={urgent ? 'var(--color-team2)' : 'var(--color-ink)'}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 100ms linear, stroke 400ms' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <HourglassSprite className="h-5 w-auto" progress={progress} />
          <span
            className={`font-mono font-semibold tabular-nums text-[20px] leading-none ${
              urgent ? 'text-[color:var(--color-team2)]' : 'text-[color:var(--color-ink)]'
            }`}
          >
            {seconds}
            <span className="text-[10px] font-normal ml-0.5 text-[color:var(--color-ink-soft)]">
              s
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
