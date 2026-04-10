/**
 * Neon signs — flickering, glowing decorative elements for Midnight in Neon Shinjuku.
 * Background signs (kanji bar, seal) are positioned fixed like FaeSigils.
 * The title bar sign (NeonTitleSign) is rendered inline in the TopBar header.
 */

/**
 * Vertical kanji sign — real kanji stacked in a narrow column.
 * 窓 (mado) = window/pane, 管 (kan) = manage/control,
 * 理 (ri) = reason/logic, 器 (ki) = tool/instrument
 * Together: "window management tool" — loosely.
 */
function SignKanjiBar(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 50 260" fill="none">
      {/* Outer frame — neon tube border */}
      <rect x="4" y="4" width="42" height="252" rx="3" stroke="currentColor" stroke-width="1.4" opacity="0.7" />

      {/* 窓 (window/pane) */}
      <text x="25" y="58" text-anchor="middle" fill="currentColor" font-size="36" font-family="serif" opacity="0.95">窓</text>

      {/* 管 (manage/control) */}
      <text x="25" y="112" text-anchor="middle" fill="currentColor" font-size="36" font-family="serif" opacity="0.9">管</text>

      {/* 理 (reason/logic) */}
      <text x="25" y="166" text-anchor="middle" fill="currentColor" font-size="36" font-family="serif" opacity="0.85">理</text>

      {/* 器 (tool/instrument) */}
      <text x="25" y="220" text-anchor="middle" fill="currentColor" font-size="36" font-family="serif" opacity="0.9">器</text>

      {/* Dot separators between characters */}
      <circle cx="25" cy="74" r="1.5" fill="currentColor" opacity="0.5" />
      <circle cx="25" cy="128" r="1.5" fill="currentColor" opacity="0.45" />
      <circle cx="25" cy="182" r="1.5" fill="currentColor" opacity="0.4" />
      <circle cx="25" cy="240" r="1.5" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

/**
 * Inline neon title sign — "PANE MANAGEMENT" in neon lettering.
 * Rendered inside the TopBar between stats and Ctrl+Space hint.
 * Compact, horizontal, meant to sit in a flex row.
 */
export function NeonTitleSign(props: { class?: string }) {
  return (
    <svg class={`neon-title-sign ${props.class || ""}`} viewBox="0 0 260 28" fill="none">
      {/* Outer frame — subtle rounded border */}
      <rect x="1" y="1" width="258" height="26" rx="4" stroke="currentColor" stroke-width="0.8" opacity="0.4" />

      {/* "PANE" — left block */}
      {/* P */}
      <g opacity="0.95">
        <line x1="12" y1="7" x2="12" y2="21" stroke="currentColor" stroke-width="1.4" />
        <path d="M12 7 L19 7 C22 7, 22 13, 19 13 L12 13" stroke="currentColor" stroke-width="1.4" fill="none" />
      </g>
      {/* A */}
      <g opacity="0.9">
        <line x1="28" y1="21" x2="33" y2="7" stroke="currentColor" stroke-width="1.4" />
        <line x1="33" y1="7" x2="38" y2="21" stroke="currentColor" stroke-width="1.4" />
        <line x1="30" y1="15" x2="36" y2="15" stroke="currentColor" stroke-width="1" />
      </g>
      {/* N */}
      <g opacity="0.95">
        <line x1="44" y1="21" x2="44" y2="7" stroke="currentColor" stroke-width="1.4" />
        <line x1="44" y1="7" x2="54" y2="21" stroke="currentColor" stroke-width="1.2" />
        <line x1="54" y1="21" x2="54" y2="7" stroke="currentColor" stroke-width="1.4" />
      </g>
      {/* E */}
      <g opacity="0.9">
        <line x1="60" y1="7" x2="60" y2="21" stroke="currentColor" stroke-width="1.4" />
        <line x1="60" y1="7" x2="70" y2="7" stroke="currentColor" stroke-width="1.2" />
        <line x1="60" y1="14" x2="68" y2="14" stroke="currentColor" stroke-width="1" />
        <line x1="60" y1="21" x2="70" y2="21" stroke="currentColor" stroke-width="1.2" />
      </g>

      {/* Diamond separator */}
      <path d="M82 14 L85 10 L88 14 L85 18 Z" stroke="currentColor" stroke-width="0.7" fill="currentColor" fill-opacity="0.25" />

      {/* "MGMT" — right block, abbreviated for compactness */}
      {/* M */}
      <g opacity="0.9">
        <line x1="100" y1="21" x2="100" y2="7" stroke="currentColor" stroke-width="1.4" />
        <line x1="100" y1="7" x2="107" y2="15" stroke="currentColor" stroke-width="1.2" />
        <line x1="107" y1="15" x2="114" y2="7" stroke="currentColor" stroke-width="1.2" />
        <line x1="114" y1="7" x2="114" y2="21" stroke="currentColor" stroke-width="1.4" />
      </g>
      {/* G */}
      <g opacity="0.85">
        <path d="M126 10 C122 7, 118 9, 118 14 C118 19, 122 21, 126 19" stroke="currentColor" stroke-width="1.4" fill="none" />
        <line x1="123" y1="14" x2="127" y2="14" stroke="currentColor" stroke-width="1" />
        <line x1="127" y1="14" x2="127" y2="19" stroke="currentColor" stroke-width="1.2" />
      </g>
      {/* M */}
      <g opacity="0.9">
        <line x1="134" y1="21" x2="134" y2="7" stroke="currentColor" stroke-width="1.4" />
        <line x1="134" y1="7" x2="141" y2="15" stroke="currentColor" stroke-width="1.2" />
        <line x1="141" y1="15" x2="148" y2="7" stroke="currentColor" stroke-width="1.2" />
        <line x1="148" y1="7" x2="148" y2="21" stroke="currentColor" stroke-width="1.4" />
      </g>
      {/* T */}
      <g opacity="0.85">
        <line x1="154" y1="7" x2="166" y2="7" stroke="currentColor" stroke-width="1.2" />
        <line x1="160" y1="7" x2="160" y2="21" stroke="currentColor" stroke-width="1.4" />
      </g>

      {/* Trailing dot accent */}
      <circle cx="178" cy="14" r="1.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Small circular sign — terminal prompt seal, like a shop stamp on glass */
function SignSeal(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 80 80" fill="none">
      {/* Outer ring — double circle neon */}
      <circle cx="40" cy="40" r="34" stroke="currentColor" stroke-width="1.4" opacity="0.6" />
      <circle cx="40" cy="40" r="30" stroke="currentColor" stroke-width="0.7" opacity="0.35" />

      {/* Inner glyph — terminal prompt >_ */}
      <path d="M26 28 L36 38 L26 48" stroke="currentColor" stroke-width="1.8" fill="none" opacity="0.95" />
      <line x1="38" y1="48" x2="54" y2="48" stroke="currentColor" stroke-width="1.6" opacity="0.85" />

      {/* Corner accents */}
      <circle cx="40" cy="22" r="1.2" fill="currentColor" opacity="0.5" />
      <circle cx="40" cy="58" r="1.2" fill="currentColor" opacity="0.5" />
      <circle cx="22" cy="40" r="1.2" fill="currentColor" opacity="0.4" />
      <circle cx="58" cy="40" r="1.2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Background neon signs — fixed position, decorative only */
export function NeonSigns() {
  return (
    <div class="neon-signs" style={{
      position: "fixed",
      inset: "0",
      "pointer-events": "none",
      "z-index": "1",
      overflow: "hidden",
    }}>
      <SignKanjiBar class="neon-sign neon-sign-kanji" />
      <SignSeal class="neon-sign neon-sign-seal" />
    </div>
  );
}
