/**
 * Fae Vines — a living vine that traces the window edges.
 * Snakes up the left edge, curls into a fiddlehead spiral in the
 * upper-left corner, then continues along the top edge.
 * Superimposed in front of everything as a decorative frame accent.
 */
export function FaeVines() {
  return (
    <div class="fae-vines">
      <svg
        class="fae-vine-frame"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
        fill="none"
        stroke="currentColor"
      >
        {/* === Dark outline layer === */}
        <g stroke="#0a0f0c" fill="none">
          {/* Left edge vine outline — hugs the edge at x=3 */}
          <path
            d="M3 800 C2 760, 5 720, 3 680 C2 640, 5 600, 3 560 C1 520, 5 480, 3 440 C2 400, 5 360, 3 320 C1 280, 5 240, 3 200 C2 160, 5 120, 3 80 C2 55, 3 40, 8 25"
            stroke-width="8" opacity="0.5"
          />
          {/* Fiddlehead outline — bigger spiral */}
          <path
            d="M8 25 C14 14, 25 6, 40 4 C58 1, 68 10, 64 24 C60 38, 48 46, 40 38 C32 30, 36 18, 46 14 C52 12, 55 16, 52 20"
            stroke-width="7" opacity="0.45"
          />
          {/* Top edge outline — hugs the edge at y=3 */}
          <path
            d="M40 4 C70 1, 90 5, 120 3 C150 1, 180 5, 210 3 C240 1, 270 5, 300 2 C330 0, 360 4, 390 3 C420 2, 450 5, 480 3 C510 1, 540 4, 570 2 C600 0, 630 4, 660 3 C690 2, 720 5, 750 3 C780 1, 810 4, 840 2 C870 0, 900 4, 930 3 C960 2, 990 5, 1020 3 C1050 1, 1080 4, 1110 2 C1140 0, 1170 3, 1200 3"
            stroke-width="7" opacity="0.4"
          />
          {/* Lanceolate leaf outlines — left (pointed ovals) */}
          <path d="M3 700 C12 688, 28 690, 30 700 C32 710, 16 718, 3 705" stroke-width="3" opacity="0.3" />
          <path d="M3 560 C12 548, 26 550, 28 560 C30 570, 14 578, 3 565" stroke-width="3" opacity="0.25" />
          <path d="M3 420 C12 408, 28 410, 30 420 C32 430, 16 438, 3 425" stroke-width="3" opacity="0.3" />
          <path d="M3 280 C12 268, 26 270, 28 280 C30 290, 14 298, 3 285" stroke-width="3" opacity="0.25" />
          <path d="M3 160 C12 148, 28 150, 30 160 C32 170, 16 178, 3 165" stroke-width="3" opacity="0.3" />
          {/* Lanceolate leaf outlines — top (hanging) */}
          <path d="M160 3 C152 16, 155 34, 160 36 C165 34, 168 16, 160 3" stroke-width="2.5" opacity="0.25" />
          <path d="M380 3 C372 16, 375 34, 380 36 C385 34, 388 16, 380 3" stroke-width="2.5" opacity="0.2" />
          <path d="M600 3 C592 16, 595 34, 600 36 C605 34, 608 16, 600 3" stroke-width="2.5" opacity="0.25" />
          <path d="M820 3 C812 16, 815 34, 820 36 C825 34, 828 16, 820 3" stroke-width="2.5" opacity="0.2" />
          <path d="M1050 3 C1042 16, 1045 34, 1050 36 C1055 34, 1058 16, 1050 3" stroke-width="2.5" opacity="0.25" />
        </g>

        {/* === Green vine layer === */}

        {/* Main vine: up the left edge — tight to x=3 */}
        <path
          d="M3 800 C2 760, 5 720, 3 680 C2 640, 5 600, 3 560 C1 520, 5 480, 3 440 C2 400, 5 360, 3 320 C1 280, 5 240, 3 200 C2 160, 5 120, 3 80 C2 55, 3 40, 8 25"
          stroke-width="4.5" opacity="0.55"
        />

        {/* Fiddlehead spiral — bigger, more loops */}
        <path
          d="M8 25 C14 14, 25 6, 40 4 C58 1, 68 10, 64 24 C60 38, 48 46, 40 38 C32 30, 36 18, 46 14 C52 12, 55 16, 52 20"
          stroke-width="3.5" opacity="0.5"
        />
        <circle cx="52" cy="20" r="4" fill="currentColor" opacity="0.45" />

        {/* Top edge — tight to y=3 */}
        <path
          d="M40 4 C70 1, 90 5, 120 3 C150 1, 180 5, 210 3 C240 1, 270 5, 300 2 C330 0, 360 4, 390 3 C420 2, 450 5, 480 3 C510 1, 540 4, 570 2 C600 0, 630 4, 660 3 C690 2, 720 5, 750 3 C780 1, 810 4, 840 2 C870 0, 900 4, 930 3 C960 2, 990 5, 1020 3 C1050 1, 1080 4, 1110 2 C1140 0, 1170 3, 1200 3"
          stroke-width="3.5" opacity="0.45"
        />

        {/* Lanceolate leaves — left edge (pointed ovals tapering to tips) */}
        <path d="M3 700 C12 688, 28 690, 30 700 C32 710, 16 718, 3 705" stroke-width="1.5" opacity="0.4" fill="currentColor" fill-opacity="0.15" />
        <path d="M3 700 C14 694, 24 696, 22 704" stroke-width="0.7" opacity="0.3" />
        <path d="M3 560 C12 548, 26 550, 28 560 C30 570, 14 578, 3 565" stroke-width="1.5" opacity="0.35" fill="currentColor" fill-opacity="0.12" />
        <path d="M3 560 C12 554, 22 556, 20 564" stroke-width="0.7" opacity="0.25" />
        <path d="M3 420 C12 408, 28 410, 30 420 C32 430, 16 438, 3 425" stroke-width="1.5" opacity="0.4" fill="currentColor" fill-opacity="0.15" />
        <path d="M3 420 C14 414, 24 416, 22 424" stroke-width="0.7" opacity="0.3" />
        <path d="M3 280 C12 268, 26 270, 28 280 C30 290, 14 298, 3 285" stroke-width="1.5" opacity="0.35" fill="currentColor" fill-opacity="0.12" />
        <path d="M3 280 C12 274, 22 276, 20 284" stroke-width="0.7" opacity="0.25" />
        <path d="M3 160 C12 148, 28 150, 30 160 C32 170, 16 178, 3 165" stroke-width="1.5" opacity="0.4" fill="currentColor" fill-opacity="0.15" />
        <path d="M3 160 C14 154, 24 156, 22 164" stroke-width="0.7" opacity="0.3" />

        {/* Lanceolate leaves — top edge (hanging down, tapered tips) */}
        <path d="M160 3 C152 16, 155 34, 160 36 C165 34, 168 16, 160 3" stroke-width="1.2" opacity="0.35" fill="currentColor" fill-opacity="0.12" />
        <path d="M160 3 C157 14, 158 26, 160 30" stroke-width="0.5" opacity="0.25" />
        <path d="M380 3 C372 16, 375 34, 380 36 C385 34, 388 16, 380 3" stroke-width="1.2" opacity="0.3" fill="currentColor" fill-opacity="0.1" />
        <path d="M380 3 C377 14, 378 26, 380 30" stroke-width="0.5" opacity="0.2" />
        <path d="M600 3 C592 16, 595 34, 600 36 C605 34, 608 16, 600 3" stroke-width="1.2" opacity="0.35" fill="currentColor" fill-opacity="0.12" />
        <path d="M600 3 C597 14, 598 26, 600 30" stroke-width="0.5" opacity="0.25" />
        <path d="M820 3 C812 16, 815 34, 820 36 C825 34, 828 16, 820 3" stroke-width="1.2" opacity="0.3" fill="currentColor" fill-opacity="0.1" />
        <path d="M820 3 C817 14, 818 26, 820 30" stroke-width="0.5" opacity="0.2" />
        <path d="M1050 3 C1042 16, 1045 34, 1050 36 C1055 34, 1058 16, 1050 3" stroke-width="1.2" opacity="0.35" fill="currentColor" fill-opacity="0.12" />
        <path d="M1050 3 C1047 14, 1048 26, 1050 30" stroke-width="0.5" opacity="0.25" />

        {/* Moss spores along vine */}
        <circle cx="9" cy="750" r="2" fill="currentColor" opacity="0.25" />
        <circle cx="11" cy="650" r="2.5" fill="currentColor" opacity="0.2" />
        <circle cx="8" cy="520" r="2" fill="currentColor" opacity="0.25" />
        <circle cx="11" cy="380" r="2.5" fill="currentColor" opacity="0.2" />
        <circle cx="9" cy="240" r="2" fill="currentColor" opacity="0.25" />
        <circle cx="11" cy="130" r="2.5" fill="currentColor" opacity="0.2" />

        <circle cx="80" cy="11" r="2" fill="currentColor" opacity="0.22" />
        <circle cx="250" cy="10" r="2.2" fill="currentColor" opacity="0.18" />
        <circle cx="460" cy="10" r="2" fill="currentColor" opacity="0.22" />
        <circle cx="660" cy="10" r="2.2" fill="currentColor" opacity="0.18" />
        <circle cx="870" cy="10" r="2" fill="currentColor" opacity="0.22" />
        <circle cx="1080" cy="9" r="2.2" fill="currentColor" opacity="0.18" />
      </svg>
    </div>
  );
}
