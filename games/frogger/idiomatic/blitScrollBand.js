// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitScrollBand — blit a scrolling tile band into video RAM from a 3-byte descriptor (column, unit count,
 * row count), choosing one of three source rows by the scroll-phase mode and toggling the wrap-latch.
 * LIVE-OUT: memory-only.
 */
import { SCROLL_BAND_DESCRIPTOR_BASE, SCROLL_BAND_PHASE, SCROLL_WRAP_LATCH, SCROLL_BAND_ROWSPAN, SCROLL_BAND_VRAM_BASE, SCROLL_BAND_ROW_A, SCROLL_BAND_ROW_B, SCROLL_BAND_ROW_C } from "./names.js";

const UNIT_SPAN = 32; // each descriptor unit shifts the band base one tile row
const ROW_STRIDE = 32;
const BAND_ROWS = 6; // three double-rows tall
const PAIR_WIDTH = 2; // cells copied from a source row
const ZERO_RUNS_FULL = 256; // a zero 8-bit count runs the counter all the way round

// scroll-phase mode -> source row; the middle modes clear the wrap-latch, the last one raises it
const PHASE_ROW_A = [0, 112];
const PHASE_ROW_B = [48, 96];
const PHASE_ROW_C = 80;

export function blitScrollBand(m) {
  const { mem8 } = m;
  const column = mem8[SCROLL_BAND_DESCRIPTOR_BASE];
  const units = mem8[(SCROLL_BAND_DESCRIPTOR_BASE + 1)];
  const rows = mem8[(SCROLL_BAND_DESCRIPTOR_BASE + 2)];

  const stride = column + ((UNIT_SPAN * units) & 0xff);
  const rowSteps = ((rows - 1) & 0xff) || ZERO_RUNS_FULL;
  const bandTop = SCROLL_BAND_VRAM_BASE + stride * rowSteps;

  const mode = mem8[SCROLL_BAND_PHASE];
  let source = -1;
  if (PHASE_ROW_A.includes(mode)) source = SCROLL_BAND_ROW_A;
  else if (PHASE_ROW_B.includes(mode)) source = SCROLL_BAND_ROW_B;
  else if (mode === PHASE_ROW_C) source = SCROLL_BAND_ROW_C;

  if (source >= 0) {
    let dst = bandTop;
    for (let row = 0; row < BAND_ROWS; row++) {
      const src = source + (row % 2) * PAIR_WIDTH;
      mem8[dst] = mem8[src];
      mem8[(dst + 1)] = mem8[(src + 1)];
      dst = dst + ROW_STRIDE;
    }
    if (PHASE_ROW_B.includes(mode)) {
      if (mem8[SCROLL_WRAP_LATCH] !== 0) mem8[SCROLL_WRAP_LATCH] = 0;
    } else if (mode === PHASE_ROW_C) {
      mem8[SCROLL_WRAP_LATCH] = 1;
    }
  }
  mem8[SCROLL_BAND_ROWSPAN] = (rows - 1) & 0xff;
}
