import { useEffect, useState } from 'react';

interface TimerProps {
  durationMs: number;
  startedAt: number;
  onExpired?: () => void;
  label?: string;
}

export function Timer({ durationMs, startedAt, onExpired, label }: TimerProps) {
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const left = Math.max(0, durationMs - elapsed);
      setRemaining(left);
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

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-sm text-text-secondary">{label}</span>}
      <div className="relative w-48 h-3 rounded-full bg-surface-alt overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-100 ${
            urgent ? 'bg-team2' : 'bg-accent'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className={`text-2xl font-mono font-bold ${urgent ? 'text-team2' : 'text-text-primary'}`}>
        {seconds}s
      </span>
    </div>
  );
}
