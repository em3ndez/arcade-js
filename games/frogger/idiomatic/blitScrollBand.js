// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitScrollBand  —  ROM 0x219c  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The river's six-row scrolling tile band — "object B" of Frogger's incremental background redraw.
 *   From a 3-byte descriptor it works out where in video RAM the band's top-left cell sits, then paints
 *   six tile rows of water/log texture straight down from there, choosing WHICH of three ROM source rows
 *   to paint by the current scroll phase. This is the visual half of the river scroll: as the phase
 *   counter sweeps, the source-row choice cycles and the band appears to flow.
 *
 * WHERE IT SITS
 *   Fired once per in-play frame by the scroll clock advanceScrollLaneObjects (ROM 0x2005), but only
 *   while object B's phase counter SCROLL_BAND_PHASE (0x8111) is still below 160. That clock steps the
 *   counter by 2 each frame; this routine reads it to pick a source row, and on two of the phases also
 *   flips the wrap-latch the frog-vs-lane collision code consults to read the pre-scroll lane lists.
 *
 * LIVE-OUT
 *   Memory only. It writes up to twelve VRAM tile cells (six rows x two), may set or clear the wrap-latch
 *   SCROLL_WRAP_LATCH (0x8108), and always stores rows-1 into the shadow SCROLL_BAND_ROWSPAN (0x8119).
 *   It returns nothing and leaves no register the caller reads (the caller reloads A).
 */
import { SCROLL_BAND_DESCRIPTOR_BASE, SCROLL_BAND_PHASE, SCROLL_WRAP_LATCH, SCROLL_BAND_ROWSPAN, SCROLL_BAND_VRAM_BASE, SCROLL_BAND_ROW_A, SCROLL_BAND_ROW_B, SCROLL_BAND_ROW_C } from "./names.js";

const UNIT_SPAN = 32;       // each descriptor "unit" shifts the band base down one tilemap row (0x20)
const ROW_STRIDE = 32;      // one tilemap row = 32 tile cells, so +32 steps straight down the band
const BAND_ROWS = 6;        // the band is six rows tall — three repeats of a two-row source pattern
const PAIR_WIDTH = 2;       // a source-row pair is 2 tile cells; odd band rows take the second pair (+2)
const ZERO_RUNS_FULL = 256; // an 8-bit count of 0 runs the ROM's djnz loop the full 256 times, not 0

// scroll-phase mode -> source row. The pairing (row A at both ends of the sweep, row B either side of
// row C) is what makes the band cycle as SCROLL_BAND_PHASE climbs 0..160; row B clears the wrap-latch,
// row C raises it, row A leaves it alone.
const PHASE_ROW_A = [0, 112]; // phases at either end of the sweep -> source row A
const PHASE_ROW_B = [48, 96]; // phases flanking the midpoint      -> source row B
const PHASE_ROW_C = 80;       // phase at the midpoint             -> source row C

export function blitScrollBand(m) {
  const { mem8 } = m;

  // ── The descriptor: column / units / rows ─────────────────────────────────────────────
  // Object B's scroll state is a 3-byte descriptor at SCROLL_BAND_DESCRIPTOR_BASE (0x827c): a column
  // offset (+0), a unit count (+1) that scales how far down the band is placed, and the band's row
  // count (+2). advanceScrollLaneObjects keeps this block current; here we only read it.
  const column = mem8[SCROLL_BAND_DESCRIPTOR_BASE];
  const units = mem8[SCROLL_BAND_DESCRIPTOR_BASE + 1];
  const rows = mem8[SCROLL_BAND_DESCRIPTOR_BASE + 2];

  // ── Where the band lands in video RAM ──────────────────────────────────────────────────
  // The band's top cell is SCROLL_BAND_VRAM_BASE (0xa80e) plus a stride walked (rows-1) times. The
  // stride is column + 32*units — the 32 being one tilemap row per unit — kept 8-bit because the ROM
  // accumulates it with a per-unit "add 0x20" that wraps at a byte. rowSteps is (rows-1) mod 256, and a
  // rows value of 1 makes that 0; the ROM's djnz walk then runs the full 256 times, so 0 means 256 here.
  const stride = column + ((UNIT_SPAN * units) & 0xff);
  const rowSteps = ((rows - 1) & 0xff) || ZERO_RUNS_FULL;
  const bandTop = SCROLL_BAND_VRAM_BASE + stride * rowSteps;

  // ── Pick the source row for this scroll phase ──────────────────────────────────────────
  // SCROLL_BAND_PHASE (0x8111) is object B's phase counter (stepped +2 per frame by the scroll clock).
  // Its exact value selects one of three 4-byte ROM source rows: 0 or 112 -> SCROLL_BAND_ROW_A (0x2231),
  // 48 or 96 -> SCROLL_BAND_ROW_B (0x2235), 80 -> SCROLL_BAND_ROW_C (0x2239). Any other value blits
  // nothing — only the tail runs. -1 is the "no source / no blit" sentinel.
  const mode = mem8[SCROLL_BAND_PHASE];
  let sourceRow = -1;
  if (PHASE_ROW_A.includes(mode)) sourceRow = SCROLL_BAND_ROW_A;
  else if (PHASE_ROW_B.includes(mode)) sourceRow = SCROLL_BAND_ROW_B;
  else if (mode === PHASE_ROW_C) sourceRow = SCROLL_BAND_ROW_C;

  if (sourceRow >= 0) {
    // ── Paint six rows down the band ─────────────────────────────────────────────────────
    // Each source row is 4 bytes = two 2-cell pairs. Even band rows copy the first pair (sourceRow+0/+1),
    // odd rows copy the second pair (sourceRow+2/+3); ROW_STRIDE (32) drops one tilemap row between them.
    // Six rows of this alternation is what gives the band its two-row-tall repeating water texture.
    let dst = bandTop;
    for (let row = 0; row < BAND_ROWS; row++) {
      const src = sourceRow + (row % 2) * PAIR_WIDTH;
      mem8[dst] = mem8[src];
      mem8[dst + 1] = mem8[src + 1];
      dst += ROW_STRIDE;
    }

    // ── Flip the wrap-latch on the phase edges ───────────────────────────────────────────
    // SCROLL_WRAP_LATCH (0x8108) tells the frog-vs-lane collision code to read the *pre-scroll* lane
    // object lists this frame. Row B (modes 48/96) clears it — writing only when it is currently set, a
    // faithful copy of the ROM's "test, then store 0" — and row C (mode 80) raises it. Row A leaves it be.
    if (PHASE_ROW_B.includes(mode)) {
      if (mem8[SCROLL_WRAP_LATCH] !== 0) mem8[SCROLL_WRAP_LATCH] = 0;
    } else if (mode === PHASE_ROW_C) {
      mem8[SCROLL_WRAP_LATCH] = 1;
    }
  }

  // ── The tail: shadow the row count ─────────────────────────────────────────────────────
  // Reached on every path — including the off-table no-blit modes. SCROLL_BAND_ROWSPAN (0x8119) is the
  // row-span shadow the scroll clock reads back next frame; it always ends holding rows-1 (mem8 masks the
  // rows=0 underflow to 0xff, matching the ROM's 8-bit dec).
  mem8[SCROLL_BAND_ROWSPAN] = rows - 1;
}
