// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceScrollLaneObjects — advance the two scroll objects one frame and, on three phase marks, restamp their lanes.
 *
 * Copies each object's scroll byte into its shadow, steps object A's counter by 1 (wrapping a reveal
 * stamp in when it reaches 80) and object B's by 2 (wrapping a band blit in when it drops below 160),
 * then advances the phase counter; at phase 16/32/48 it feeds each object's descriptor into the
 * scroll copy engine, and phase 48 also resets the phase counter to 0.
 * LIVE-OUT: memory-only.
 */
import {
  SCROLL_OBJECT_BLOCK_BASE, SCROLL_OBJ_A_ROW_COUNT, SCROLL_BAND_DESCRIPTOR_BASE, SCROLL_OBJ_B_ROW_COUNT, SCROLL_STAMP_ROWCOUNT, SCROLL_BAND_ROWSPAN,
  SCROLL_STAMP_PHASE, SCROLL_BAND_PHASE, SCROLL_PHASE_COUNTER, SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_GRID_SRC_PHASE16, SCROLL_BAND_SRC_PHASE16, SCROLL_GRID_SRC_PHASE32, SCROLL_BAND_SRC_PHASE32, SCROLL_GRID_SRC_PHASE48, SCROLL_BAND_SRC_PHASE48,
} from "./names.js";
import { stampScrollRevealColumn } from "./stampScrollRevealColumn.js";
import { blitScrollBand } from "./blitScrollBand.js";
import { blitScrollTileGrid, blitScrollTileGridAlt } from "./blitScrollTileGrid.js";

const SCROLL_BYTE = 2; // +2 field of each 3-byte object descriptor
const COUNTER_A_STAMP = 80;
const COUNTER_B_FLOOR = 160;
const PHASE_LANE_A = 16;
const PHASE_LANE_B = 32;
const PHASE_LANE_C = 48;

export function advanceScrollLaneObjects(m) {
  const { mem8 } = m;

  mem8[SCROLL_STAMP_ROWCOUNT] = mem8[(SCROLL_OBJECT_BLOCK_BASE + SCROLL_BYTE) & 0xffff];
  const a = (mem8[SCROLL_STAMP_PHASE] + 1) & 0xff;
  mem8[SCROLL_STAMP_PHASE] = a;
  if (a >= COUNTER_A_STAMP) stampScrollRevealColumn(m);

  mem8[SCROLL_BAND_ROWSPAN] = mem8[(SCROLL_BAND_DESCRIPTOR_BASE + SCROLL_BYTE) & 0xffff];
  const b = (mem8[SCROLL_BAND_PHASE] + 2) & 0xff;
  mem8[SCROLL_BAND_PHASE] = b;
  if (b < COUNTER_B_FLOOR) blitScrollBand(m);

  const phase = (mem8[SCROLL_PHASE_COUNTER] + 1) & 0xff;
  mem8[SCROLL_PHASE_COUNTER] = phase;
  if (phase === PHASE_LANE_A) return stampLanes(m, SCROLL_GRID_SRC_PHASE16, SCROLL_BAND_SRC_PHASE16, false);
  if (phase === PHASE_LANE_B) return stampLanes(m, SCROLL_GRID_SRC_PHASE32, SCROLL_BAND_SRC_PHASE32, false);
  if (phase === PHASE_LANE_C) return stampLanes(m, SCROLL_GRID_SRC_PHASE48, SCROLL_BAND_SRC_PHASE48, true);
}

// Feed object A's descriptor into the grid copy engine, then object B's into the alt-base engine;
// the wrapping phase (48) also clears the phase counter before the copy.
function stampLanes(m, gridSource, bandSource, wrapPhase) {
  const { regs, mem8 } = m;

  regs.b = mem8[(SCROLL_OBJECT_BLOCK_BASE + 1) & 0xffff];
  regs.c = mem8[SCROLL_STAMP_ROWCOUNT];
  regs.de = gridSource;
  mem8[SCROLL_COPY_COLUMN_STRIDE] = mem8[SCROLL_OBJECT_BLOCK_BASE];
  if (wrapPhase) mem8[SCROLL_PHASE_COUNTER] = 0;
  blitScrollTileGrid(m);

  regs.b = mem8[(SCROLL_BAND_DESCRIPTOR_BASE + 1) & 0xffff];
  regs.c = mem8[SCROLL_BAND_ROWSPAN];
  regs.de = bandSource;
  mem8[SCROLL_COPY_COLUMN_STRIDE] = mem8[SCROLL_BAND_DESCRIPTOR_BASE];
  return blitScrollTileGridAlt(m);
}
