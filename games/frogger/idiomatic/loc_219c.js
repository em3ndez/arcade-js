// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_219c — blit a scrolling tile band into video RAM from a 3-byte descriptor (column, unit count,
 * row count), choosing one of three source rows by the scroll-phase mode and toggling the wrap-latch.
 * LIVE-OUT: memory-only.
 */
import { loc_827c, loc_8111, loc_8108, loc_8119, loc_a80e, loc_2231, loc_2235, loc_2239 } from "./names.js";

const UNIT_SPAN = 32; // each descriptor unit shifts the band base one tile row
const ROW_STRIDE = 32;
const BAND_ROWS = 6; // three double-rows tall
const PAIR_WIDTH = 2; // cells copied from a source row
const ZERO_RUNS_FULL = 256; // a zero 8-bit count runs the counter all the way round

// scroll-phase mode -> source row; the middle modes clear the wrap-latch, the last one raises it
const PHASE_ROW_A = [0, 112];
const PHASE_ROW_B = [48, 96];
const PHASE_ROW_C = 80;

export function loc_219c(m) {
  const { mem8 } = m;
  const column = mem8[loc_827c];
  const units = mem8[(loc_827c + 1) & 0xffff];
  const rows = mem8[(loc_827c + 2) & 0xffff];

  const stride = (column + ((UNIT_SPAN * units) & 0xff)) & 0xffff;
  const rowSteps = ((rows - 1) & 0xff) || ZERO_RUNS_FULL;
  const bandTop = (loc_a80e + stride * rowSteps) & 0xffff;

  const mode = mem8[loc_8111];
  let source = -1;
  if (PHASE_ROW_A.includes(mode)) source = loc_2231;
  else if (PHASE_ROW_B.includes(mode)) source = loc_2235;
  else if (mode === PHASE_ROW_C) source = loc_2239;

  if (source >= 0) {
    let dst = bandTop;
    for (let row = 0; row < BAND_ROWS; row++) {
      const src = (source + (row % 2) * PAIR_WIDTH) & 0xffff;
      mem8[dst] = mem8[src];
      mem8[(dst + 1) & 0xffff] = mem8[(src + 1) & 0xffff];
      dst = (dst + ROW_STRIDE) & 0xffff;
    }
    if (PHASE_ROW_B.includes(mode)) {
      if (mem8[loc_8108] !== 0) mem8[loc_8108] = 0;
    } else if (mode === PHASE_ROW_C) {
      mem8[loc_8108] = 1;
    }
  }
  mem8[loc_8119] = (rows - 1) & 0xff;
}
