const SOUND_KEY = 'castlefall_sound_enabled';
const BASE = import.meta.env.BASE_URL + 'sounds/';

const soundFiles: Record<string, string> = {
  join: 'join.wav',
  roundStart: 'round-start.wav',
  declare: 'declare.wav',
  timerUrgent: 'timer-urgent.wav',
  reveal: 'reveal.wav',
};

const audioCache: Record<string, HTMLAudioElement> = {};

function preload() {
  for (const [key, file] of Object.entries(soundFiles)) {
    const audio = new Audio(BASE + file);
    audio.preload = 'auto';
    audio.volume = 0.4;
    audioCache[key] = audio;
  }
}

let preloaded = false;

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== 'false';
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, String(enabled));
}

export function playSound(name: string) {
  if (!isSoundEnabled()) return;

  if (!preloaded) {
    preload();
    preloaded = true;
  }

  const original = audioCache[name];
  if (!original) return;

  const clone = original.cloneNode() as HTMLAudioElement;
  clone.volume = original.volume;
  clone.play().catch(() => {});
}
