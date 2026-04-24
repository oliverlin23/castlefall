/**
 * Hand-drawn inline SVG pixel-art sprites for the Castlefall paper-ink theme.
 * Every sprite renders on a small integer grid with `shape-rendering="crispEdges"`
 * so the strokes hit pixel boundaries cleanly when scaled.
 *
 * All sprites accept a `className` so the parent can size them with Tailwind
 * (`w-8 h-8`, etc.) and a few accept `tone` to recolor their accent fill.
 */

import type { CSSProperties } from 'react';

type Tone = 'ink' | 'team1' | 'team2' | 'gold' | 'violet' | 'moss' | 'seal';

const toneToVar: Record<Tone, string> = {
  ink: 'var(--color-ink)',
  team1: 'var(--color-team1)',
  team2: 'var(--color-team2)',
  gold: 'var(--color-banner-gold)',
  violet: 'var(--color-violet)',
  moss: 'var(--color-moss)',
  seal: 'var(--color-seal-red)',
};

interface SpriteProps {
  className?: string;
  style?: CSSProperties;
  title?: string;
}

interface ColoredSpriteProps extends SpriteProps {
  tone?: Tone;
}

/* ------------------------------------------------------------------ */
/*  CASTLE — used as wordmark glyph in the header / entry screen      */
/* ------------------------------------------------------------------ */
export function CastleSprite({ className, style, title }: SpriteProps) {
  return (
    <svg
      viewBox="0 0 32 24"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      fill="currentColor"
    >
      {/* sky strip — none, transparent */}
      {/* flag pole + flag */}
      <rect x="15" y="0" width="1" height="5" />
      <rect x="16" y="1" width="4" height="2" fill="var(--color-seal-red)" />
      {/* center keep */}
      <rect x="13" y="5" width="6" height="6" />
      <rect x="12" y="4" width="1" height="1" />
      <rect x="14" y="4" width="1" height="1" />
      <rect x="17" y="4" width="1" height="1" />
      <rect x="19" y="4" width="1" height="1" />
      {/* keep window */}
      <rect x="15" y="7" width="2" height="2" fill="var(--color-paper-bright)" />
      {/* left tower */}
      <rect x="4" y="9" width="4" height="8" />
      <rect x="3" y="8" width="1" height="1" />
      <rect x="5" y="8" width="1" height="1" />
      <rect x="7" y="8" width="1" height="1" />
      <rect x="5" y="11" width="2" height="2" fill="var(--color-paper-bright)" />
      {/* right tower */}
      <rect x="24" y="9" width="4" height="8" />
      <rect x="23" y="8" width="1" height="1" />
      <rect x="25" y="8" width="1" height="1" />
      <rect x="27" y="8" width="1" height="1" />
      <rect x="25" y="11" width="2" height="2" fill="var(--color-paper-bright)" />
      {/* curtain wall */}
      <rect x="8" y="13" width="16" height="4" />
      <rect x="9" y="12" width="2" height="1" />
      <rect x="13" y="12" width="2" height="1" />
      <rect x="17" y="12" width="2" height="1" />
      <rect x="21" y="12" width="2" height="1" />
      {/* gate */}
      <rect x="14" y="14" width="4" height="3" fill="var(--color-paper-bright)" />
      <rect x="15" y="15" width="2" height="2" />
      {/* ground line */}
      <rect x="0" y="17" width="32" height="1" />
      <rect x="0" y="19" width="32" height="1" fill="var(--color-ink-soft)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  CASTLE — small icon (16x16) for buttons / favicon-ish use         */
/* ------------------------------------------------------------------ */
export function CastleIcon({ className, style, title }: SpriteProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      fill="currentColor"
    >
      <rect x="9" y="0" width="1" height="3" />
      <rect x="10" y="0" width="3" height="2" fill="var(--color-seal-red)" />
      <rect x="6" y="3" width="4" height="3" />
      <rect x="6" y="2" width="1" height="1" />
      <rect x="8" y="2" width="1" height="1" />
      <rect x="2" y="6" width="2" height="1" />
      <rect x="5" y="6" width="2" height="1" />
      <rect x="9" y="6" width="2" height="1" />
      <rect x="12" y="6" width="2" height="1" />
      <rect x="2" y="7" width="12" height="6" />
      <rect x="7" y="9" width="2" height="4" fill="var(--color-paper-bright)" />
      <rect x="7" y="9" width="2" height="1" />
      <rect x="0" y="13" width="16" height="1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  CRACKED CASTLE — a fallen castle, used on results / loss screens   */
/* ------------------------------------------------------------------ */
export function FallenCastleSprite({ className, style, title }: SpriteProps) {
  return (
    <svg
      viewBox="0 0 32 24"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      fill="currentColor"
    >
      {/* leaning flag */}
      <rect x="6" y="2" width="1" height="5" transform="rotate(-12 6 7)" />
      <rect x="3" y="0" width="3" height="2" fill="var(--color-seal-red)" />
      {/* broken keep */}
      <rect x="13" y="6" width="6" height="5" />
      <rect x="12" y="5" width="1" height="1" />
      <rect x="14" y="5" width="1" height="1" />
      {/* missing chunk top right */}
      <rect x="17" y="6" width="2" height="2" fill="var(--color-paper)" />
      <rect x="15" y="8" width="2" height="2" fill="var(--color-paper-bright)" />
      {/* broken left tower (short, jagged) */}
      <rect x="4" y="11" width="4" height="6" />
      <rect x="3" y="10" width="1" height="1" />
      <rect x="6" y="9" width="2" height="1" />
      {/* right tower fallen — rubble */}
      <rect x="22" y="14" width="3" height="3" />
      <rect x="25" y="15" width="2" height="2" />
      <rect x="27" y="16" width="1" height="1" />
      {/* curtain wall — gapped */}
      <rect x="8" y="13" width="6" height="4" />
      <rect x="9" y="12" width="2" height="1" />
      <rect x="12" y="12" width="2" height="1" />
      <rect x="18" y="13" width="4" height="4" />
      {/* gate broken open */}
      <rect x="11" y="14" width="2" height="3" fill="var(--color-paper-bright)" />
      {/* rubble dust */}
      <rect x="0" y="17" width="32" height="1" />
      <rect x="13" y="18" width="1" height="1" fill="var(--color-ink-soft)" />
      <rect x="20" y="18" width="2" height="1" fill="var(--color-ink-soft)" />
      <rect x="6" y="19" width="2" height="1" fill="var(--color-ink-soft)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  HERALDIC PENNANT — team marker, recolorable via tone               */
/* ------------------------------------------------------------------ */
export function PennantSprite({
  className,
  style,
  title,
  tone = 'team1',
}: ColoredSpriteProps) {
  const fill = toneToVar[tone];
  return (
    <svg
      viewBox="0 0 16 16"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {/* pole */}
      <rect x="2" y="0" width="1" height="16" fill="var(--color-ink)" />
      {/* pennant flag — triangular swallowtail */}
      <path
        d="M3 1 H14 L11 4 H14 L11 7 H3 Z"
        fill={fill}
      />
      <path
        d="M3 1 H14 L11 4 H14 L11 7 H3 Z"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="0.5"
      />
      {/* sigil — a small dot */}
      <rect x="6" y="3" width="2" height="2" fill="var(--color-paper-bright)" />
      {/* base nub */}
      <rect x="1" y="14" width="3" height="2" fill="var(--color-ink)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  CROWN — used on the assigned word & winning team                   */
/* ------------------------------------------------------------------ */
export function CrownSprite({
  className,
  style,
  title,
  tone = 'gold',
}: ColoredSpriteProps) {
  const fill = toneToVar[tone];
  return (
    <svg
      viewBox="0 0 16 12"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {/* base band */}
      <rect x="2" y="8" width="12" height="2" fill={fill} />
      <rect x="2" y="7" width="12" height="1" fill="var(--color-ink)" />
      <rect x="2" y="10" width="12" height="1" fill="var(--color-ink)" />
      {/* peaks */}
      <rect x="2" y="3" width="2" height="5" fill={fill} />
      <rect x="7" y="3" width="2" height="5" fill={fill} />
      <rect x="12" y="3" width="2" height="5" fill={fill} />
      <rect x="4" y="6" width="3" height="2" fill={fill} />
      <rect x="9" y="6" width="3" height="2" fill={fill} />
      {/* peak highlights */}
      <rect x="2" y="2" width="2" height="1" fill="var(--color-ink)" />
      <rect x="7" y="2" width="2" height="1" fill="var(--color-ink)" />
      <rect x="12" y="2" width="2" height="1" fill="var(--color-ink)" />
      {/* gem dots */}
      <rect x="2" y="0" width="2" height="2" fill="var(--color-team2)" />
      <rect x="7" y="0" width="2" height="2" fill="var(--color-team2)" />
      <rect x="12" y="0" width="2" height="2" fill="var(--color-team2)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  SCROLL — decoration, e.g. above word lists                         */
/* ------------------------------------------------------------------ */
export function ScrollSprite({ className, style, title }: SpriteProps) {
  return (
    <svg
      viewBox="0 0 24 16"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {/* scroll body */}
      <rect x="2" y="3" width="20" height="10" fill="var(--color-paper-bright)" />
      <rect x="2" y="3" width="20" height="1" fill="var(--color-ink)" />
      <rect x="2" y="12" width="20" height="1" fill="var(--color-ink)" />
      <rect x="2" y="3" width="1" height="10" fill="var(--color-ink)" />
      <rect x="21" y="3" width="1" height="10" fill="var(--color-ink)" />
      {/* text rules */}
      <rect x="5" y="6" width="14" height="1" fill="var(--color-ink-soft)" />
      <rect x="5" y="9" width="10" height="1" fill="var(--color-ink-soft)" />
      {/* left roll */}
      <rect x="0" y="2" width="2" height="12" fill="var(--color-ink)" />
      <rect x="1" y="3" width="1" height="10" fill="var(--color-banner-gold-soft)" />
      {/* right roll */}
      <rect x="22" y="2" width="2" height="12" fill="var(--color-ink)" />
      <rect x="22" y="3" width="1" height="10" fill="var(--color-banner-gold-soft)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  WAX SEAL — used as a decorative stamp on hero panels               */
/* ------------------------------------------------------------------ */
export function WaxSealSprite({
  className,
  style,
  title,
  tone = 'seal',
}: ColoredSpriteProps) {
  const fill = toneToVar[tone];
  return (
    <svg
      viewBox="0 0 16 16"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {/* wax blob — stepped pixel circle */}
      <rect x="5" y="2" width="6" height="1" fill={fill} />
      <rect x="3" y="3" width="10" height="2" fill={fill} />
      <rect x="2" y="5" width="12" height="6" fill={fill} />
      <rect x="3" y="11" width="10" height="2" fill={fill} />
      <rect x="5" y="13" width="6" height="1" fill={fill} />
      {/* drips */}
      <rect x="3" y="13" width="1" height="2" fill={fill} />
      <rect x="12" y="13" width="1" height="2" fill={fill} />
      {/* embossed inner ring */}
      <rect x="5" y="5" width="6" height="1" fill="var(--color-ink)" />
      <rect x="4" y="6" width="1" height="4" fill="var(--color-ink)" />
      <rect x="11" y="6" width="1" height="4" fill="var(--color-ink)" />
      <rect x="5" y="10" width="6" height="1" fill="var(--color-ink)" />
      {/* CF monogram — the C and F are abstracted as two tiny bars */}
      <rect x="6" y="7" width="2" height="2" fill="var(--color-paper-bright)" />
      <rect x="9" y="7" width="1" height="2" fill="var(--color-paper-bright)" />
      <rect x="9" y="7" width="2" height="1" fill="var(--color-paper-bright)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  TOWER — small lonely tower, used on empty states                   */
/* ------------------------------------------------------------------ */
export function TowerSprite({ className, style, title }: SpriteProps) {
  return (
    <svg
      viewBox="0 0 12 24"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      fill="currentColor"
    >
      {/* flag */}
      <rect x="6" y="0" width="1" height="4" />
      <rect x="7" y="0" width="3" height="2" fill="var(--color-seal-red)" />
      {/* battlements */}
      <rect x="2" y="4" width="2" height="1" />
      <rect x="5" y="4" width="2" height="1" />
      <rect x="8" y="4" width="2" height="1" />
      {/* tower body */}
      <rect x="2" y="5" width="8" height="14" />
      {/* windows */}
      <rect x="5" y="8" width="2" height="2" fill="var(--color-paper-bright)" />
      <rect x="5" y="13" width="2" height="2" fill="var(--color-paper-bright)" />
      {/* door */}
      <rect x="5" y="17" width="2" height="2" fill="var(--color-paper-bright)" />
      {/* ground */}
      <rect x="0" y="19" width="12" height="1" />
      <rect x="0" y="22" width="12" height="1" fill="var(--color-ink-soft)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  BANNER — hanging cloth banner, used as section header surface      */
/* ------------------------------------------------------------------ */
export function BannerStripSprite({
  className,
  style,
  title,
  tone = 'team1',
}: ColoredSpriteProps) {
  const fill = toneToVar[tone];
  return (
    <svg
      viewBox="0 0 64 16"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      preserveAspectRatio="none"
    >
      {/* hanging rope */}
      <rect x="0" y="0" width="64" height="1" fill="var(--color-ink)" />
      {/* main banner */}
      <rect x="2" y="1" width="60" height="11" fill={fill} />
      <rect x="2" y="1" width="60" height="1" fill="var(--color-ink)" />
      <rect x="2" y="1" width="1" height="11" fill="var(--color-ink)" />
      <rect x="61" y="1" width="1" height="11" fill="var(--color-ink)" />
      {/* tassels — alternating */}
      <rect x="3" y="12" width="2" height="3" fill={fill} />
      <rect x="7" y="12" width="2" height="2" fill={fill} />
      <rect x="11" y="12" width="2" height="3" fill={fill} />
      <rect x="15" y="12" width="2" height="2" fill={fill} />
      <rect x="19" y="12" width="2" height="3" fill={fill} />
      <rect x="23" y="12" width="2" height="2" fill={fill} />
      <rect x="27" y="12" width="2" height="3" fill={fill} />
      <rect x="31" y="12" width="2" height="2" fill={fill} />
      <rect x="35" y="12" width="2" height="3" fill={fill} />
      <rect x="39" y="12" width="2" height="2" fill={fill} />
      <rect x="43" y="12" width="2" height="3" fill={fill} />
      <rect x="47" y="12" width="2" height="2" fill={fill} />
      <rect x="51" y="12" width="2" height="3" fill={fill} />
      <rect x="55" y="12" width="2" height="2" fill={fill} />
      <rect x="59" y="12" width="2" height="3" fill={fill} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  QUILL — used as a typing/loading glyph                              */
/* ------------------------------------------------------------------ */
export function QuillSprite({ className, style, title }: SpriteProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      fill="currentColor"
    >
      {/* nib */}
      <rect x="2" y="13" width="3" height="1" />
      <rect x="3" y="12" width="3" height="1" />
      {/* shaft */}
      <rect x="5" y="11" width="2" height="1" />
      <rect x="6" y="10" width="2" height="1" />
      <rect x="7" y="9" width="2" height="1" />
      <rect x="8" y="8" width="2" height="1" />
      <rect x="9" y="7" width="2" height="1" />
      {/* feather */}
      <rect x="10" y="2" width="3" height="6" fill="var(--color-banner-gold)" />
      <rect x="10" y="2" width="3" height="1" />
      <rect x="13" y="3" width="1" height="5" />
      <rect x="11" y="4" width="2" height="1" />
      <rect x="11" y="6" width="2" height="1" />
      {/* ink dot */}
      <rect x="1" y="14" width="2" height="1" fill="var(--color-ink-soft)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  INK SPLATTER — decoration                                           */
/* ------------------------------------------------------------------ */
export function InkSplatter({ className, style }: SpriteProps) {
  return (
    <svg
      viewBox="0 0 24 16"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      fill="var(--color-ink)"
      aria-hidden="true"
    >
      <rect x="10" y="6" width="4" height="3" />
      <rect x="9" y="7" width="1" height="1" />
      <rect x="14" y="7" width="1" height="1" />
      <rect x="11" y="5" width="2" height="1" />
      <rect x="11" y="9" width="2" height="1" />
      {/* speckles */}
      <rect x="3" y="3" width="1" height="1" />
      <rect x="6" y="11" width="1" height="1" />
      <rect x="18" y="2" width="1" height="1" />
      <rect x="20" y="9" width="1" height="1" />
      <rect x="16" y="12" width="1" height="1" />
      <rect x="2" y="9" width="1" height="1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  SHIELD — used on team cards in results                              */
/* ------------------------------------------------------------------ */
export function ShieldSprite({
  className,
  style,
  title,
  tone = 'team1',
}: ColoredSpriteProps) {
  const fill = toneToVar[tone];
  return (
    <svg
      viewBox="0 0 16 18"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {/* shield outline */}
      <rect x="3" y="1" width="10" height="1" fill="var(--color-ink)" />
      <rect x="2" y="2" width="12" height="1" fill="var(--color-ink)" />
      <rect x="2" y="3" width="1" height="9" fill="var(--color-ink)" />
      <rect x="13" y="3" width="1" height="9" fill="var(--color-ink)" />
      <rect x="3" y="12" width="1" height="2" fill="var(--color-ink)" />
      <rect x="12" y="12" width="1" height="2" fill="var(--color-ink)" />
      <rect x="4" y="14" width="1" height="1" fill="var(--color-ink)" />
      <rect x="11" y="14" width="1" height="1" fill="var(--color-ink)" />
      <rect x="5" y="15" width="2" height="1" fill="var(--color-ink)" />
      <rect x="9" y="15" width="2" height="1" fill="var(--color-ink)" />
      <rect x="7" y="16" width="2" height="1" fill="var(--color-ink)" />
      {/* shield fill */}
      <rect x="3" y="2" width="10" height="1" fill={fill} />
      <rect x="3" y="3" width="10" height="9" fill={fill} />
      <rect x="4" y="12" width="8" height="2" fill={fill} />
      <rect x="5" y="14" width="6" height="1" fill={fill} />
      <rect x="7" y="15" width="2" height="1" fill={fill} />
      {/* sigil — a tiny pixel cross */}
      <rect x="7" y="5" width="2" height="6" fill="var(--color-paper-bright)" />
      <rect x="5" y="7" width="6" height="2" fill="var(--color-paper-bright)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  CHAT QUILL ICON — small icon for the chat toggle                    */
/* ------------------------------------------------------------------ */
export function ChatGlyph({ className, style, title }: SpriteProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      fill="currentColor"
    >
      {/* speech scroll */}
      <rect x="2" y="3" width="12" height="1" />
      <rect x="2" y="9" width="12" height="1" />
      <rect x="2" y="3" width="1" height="6" />
      <rect x="13" y="3" width="1" height="6" />
      <rect x="4" y="5" width="6" height="1" />
      <rect x="4" y="7" width="8" height="1" />
      {/* scroll tail */}
      <rect x="4" y="10" width="2" height="1" />
      <rect x="3" y="11" width="2" height="1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  HOURGLASS — used on the timer                                       */
/* ------------------------------------------------------------------ */
export function HourglassSprite({
  className,
  style,
  title,
  progress = 1,
}: SpriteProps & { progress?: number }) {
  const sandFill = Math.max(0, Math.min(1, progress));
  // Top sand height: more sand at full progress
  const topSandHeight = Math.round(sandFill * 4);
  const botSandHeight = 4 - topSandHeight;
  return (
    <svg
      viewBox="0 0 12 16"
      className={`pixel-art ${className ?? ''}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      fill="var(--color-ink)"
    >
      {/* frame */}
      <rect x="1" y="0" width="10" height="1" />
      <rect x="1" y="15" width="10" height="1" />
      <rect x="2" y="1" width="8" height="1" />
      <rect x="2" y="14" width="8" height="1" />
      {/* glass walls */}
      <rect x="2" y="2" width="1" height="5" />
      <rect x="9" y="2" width="1" height="5" />
      <rect x="2" y="9" width="1" height="5" />
      <rect x="9" y="9" width="1" height="5" />
      {/* funnel */}
      <rect x="3" y="7" width="6" height="1" />
      <rect x="4" y="8" width="4" height="1" />
      {/* sand top */}
      {topSandHeight > 0 && (
        <rect
          x="3"
          y={2 + (4 - topSandHeight)}
          width="6"
          height={topSandHeight}
          fill="var(--color-banner-gold)"
        />
      )}
      {/* sand bottom */}
      {botSandHeight > 0 && (
        <rect
          x="3"
          y={13 - botSandHeight + 1}
          width="6"
          height={botSandHeight}
          fill="var(--color-banner-gold)"
        />
      )}
      {/* trickle */}
      {sandFill > 0 && sandFill < 1 && (
        <rect x="5" y="8" width="2" height="1" fill="var(--color-banner-gold)" />
      )}
    </svg>
  );
}
