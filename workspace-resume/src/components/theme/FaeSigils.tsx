/**
 * Fae sigils — subtle mystical glyphs placed in the background of the UI.
 * Only visible in The Witching Hour theme. Very low opacity, decorative only.
 * Each sigil is a hand-crafted SVG with organic, slightly asymmetric geometry.
 */

/** Triquetra-inspired knot — interwoven loops, Celtic/fae energy */
function SigilTriquetra(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="0.8">
      <path d="M40 12 C28 24, 18 40, 40 52 C62 40, 52 24, 40 12Z" />
      <path d="M22 56 C22 38, 32 28, 40 40 C32 52, 22 52, 22 56Z" />
      <path d="M58 56 C58 52, 48 52, 40 40 C48 28, 58 38, 58 56Z" />
      <circle cx="40" cy="38" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Moon phase glyph — crescent with radiating marks */
function SigilMoon(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="0.8">
      <path d="M48 16 C32 20, 24 32, 24 44 C24 56, 32 64, 48 68 C38 62, 34 52, 34 44 C34 36, 38 26, 48 16Z" />
      <line x1="52" y1="28" x2="58" y2="24" />
      <line x1="56" y1="36" x2="62" y2="34" />
      <line x1="56" y1="46" x2="62" y2="48" />
      <line x1="52" y1="56" x2="58" y2="60" />
      <circle cx="50" cy="42" r="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/** Seed of life fragment — overlapping circles, sacred geometry made organic */
function SigilSeed(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="0.6">
      <circle cx="40" cy="40" r="14" />
      <circle cx="40" cy="28" r="14" opacity="0.7" />
      <circle cx="52" cy="34" r="14" opacity="0.5" />
      <circle cx="52" cy="46" r="14" opacity="0.4" />
      <circle cx="40" cy="52" r="14" opacity="0.3" />
      <circle cx="28" cy="46" r="14" opacity="0.4" />
      <circle cx="28" cy="34" r="14" opacity="0.5" />
      <circle cx="40" cy="40" r="3" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

/** Vine spiral — organic tendril curling inward */
function SigilVine(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="0.7">
      <path d="M20 65 C25 55, 30 48, 35 42 C40 36, 48 32, 50 28 C52 24, 50 20, 46 18 C42 16, 40 18, 40 22 C40 26, 44 28, 44 24" />
      <circle cx="22" cy="62" r="2" fill="currentColor" opacity="0.3" />
      <path d="M30 50 C28 46, 24 45, 22 47" opacity="0.5" />
      <path d="M42 36 C44 32, 48 33, 46 36" opacity="0.5" />
      <circle cx="44" cy="23" r="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Dotted spiral — golden ratio spiral with small dots orbiting along the path */
function SigilSpiral(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="0.6">
      {/* Main spiral */}
      <path d="M40 40 C40 36, 44 34, 46 36 C48 38, 48 42, 44 44 C40 46, 36 44, 34 40 C32 36, 34 30, 40 28 C46 26, 52 30, 54 36 C56 42, 52 50, 44 52 C36 54, 28 50, 26 42 C24 34, 28 24, 38 22 C48 20, 58 28, 60 38" />
      {/* Orbiting dots along the spiral */}
      <circle cx="46" cy="36" r="1.2" fill="currentColor" opacity="0.5" />
      <circle cx="44" cy="44" r="1" fill="currentColor" opacity="0.4" />
      <circle cx="34" cy="40" r="1.4" fill="currentColor" opacity="0.45" />
      <circle cx="40" cy="28" r="1.1" fill="currentColor" opacity="0.35" />
      <circle cx="54" cy="36" r="1.3" fill="currentColor" opacity="0.4" />
      <circle cx="44" cy="52" r="1" fill="currentColor" opacity="0.3" />
      <circle cx="26" cy="42" r="1.5" fill="currentColor" opacity="0.35" />
      <circle cx="38" cy="22" r="1.2" fill="currentColor" opacity="0.25" />
      <circle cx="60" cy="38" r="1.6" fill="currentColor" opacity="0.3" />
      {/* Center eye */}
      <circle cx="40" cy="40" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="40" cy="40" r="0.8" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

/** Constellation — scattered stars connected by faint lines, like a sky map */
function SigilConstellation(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="0.4">
      {/* Star points */}
      <circle cx="20" cy="25" r="1.8" fill="currentColor" opacity="0.5" />
      <circle cx="35" cy="18" r="1.2" fill="currentColor" opacity="0.4" />
      <circle cx="50" cy="22" r="2" fill="currentColor" opacity="0.45" />
      <circle cx="62" cy="30" r="1.4" fill="currentColor" opacity="0.35" />
      <circle cx="55" cy="45" r="1.6" fill="currentColor" opacity="0.4" />
      <circle cx="40" cy="40" r="2.2" fill="currentColor" opacity="0.5" />
      <circle cx="28" cy="50" r="1.3" fill="currentColor" opacity="0.35" />
      <circle cx="18" cy="60" r="1.8" fill="currentColor" opacity="0.45" />
      <circle cx="45" cy="58" r="1.5" fill="currentColor" opacity="0.4" />
      <circle cx="60" cy="55" r="1.2" fill="currentColor" opacity="0.3" />
      <circle cx="38" cy="65" r="1" fill="currentColor" opacity="0.25" />
      {/* Connecting lines — faint threads between stars */}
      <line x1="20" y1="25" x2="35" y2="18" opacity="0.4" />
      <line x1="35" y1="18" x2="50" y2="22" opacity="0.35" />
      <line x1="50" y1="22" x2="62" y2="30" opacity="0.3" />
      <line x1="62" y1="30" x2="55" y2="45" opacity="0.25" />
      <line x1="40" y1="40" x2="55" y2="45" opacity="0.3" />
      <line x1="40" y1="40" x2="28" y2="50" opacity="0.35" />
      <line x1="28" y1="50" x2="18" y2="60" opacity="0.3" />
      <line x1="40" y1="40" x2="50" y2="22" opacity="0.2" />
      <line x1="45" y1="58" x2="60" y2="55" opacity="0.25" />
      <line x1="28" y1="50" x2="45" y2="58" opacity="0.3" />
      <line x1="18" y1="60" x2="38" y2="65" opacity="0.2" />
    </svg>
  );
}

export function FaeSigils() {
  return (
    <div class="fae-sigils" style={{
      position: "fixed",
      inset: "0",
      "pointer-events": "none",
      "z-index": "1",
      overflow: "hidden",
    }}>
      <SigilTriquetra class="fae-sigil fae-sigil-triquetra" />
      <SigilMoon class="fae-sigil fae-sigil-moon" />
      <SigilSeed class="fae-sigil fae-sigil-seed" />
      <SigilVine class="fae-sigil fae-sigil-vine" />
      <SigilSpiral class="fae-sigil fae-sigil-spiral" />
      <SigilConstellation class="fae-sigil fae-sigil-constellation" />
    </div>
  );
}
