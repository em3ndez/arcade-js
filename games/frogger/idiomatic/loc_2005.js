// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2005 — advance the two scroll objects one frame and, on three phase marks, restamp their lanes.
 *
 * Copies each object's scroll byte into its shadow, steps object A's counter by 1 (wrapping a reveal
 * stamp in when it reaches 80) and object B's by 2 (wrapping a band blit in when it drops below 160),
 * then advances the phase counter; at phase 16/32/48 it feeds each object's descriptor into the
 * scroll copy engine, and phase 48 also resets the phase counter to 0.
 * LIVE-OUT: memory-only.
 */
import {
  loc_8273, loc_8274, loc_827c, loc_827d, loc_811a, loc_8119,
  loc_8110, loc_8111, loc_826e, loc_81b1,
  loc_1423, loc_145f, loc_142b, loc_1473, loc_1433, loc_1487,
} from "./names.js";
import { stampScrollRevealColumn } from "./stampScrollRevealColumn.js";
import { blitScrollBand } from "./blitScrollBand.js";
import { blitScrollTileGrid } from "./blitScrollTileGrid.js";

const COPY_SCROLL_GRID_ALT = 0x20bf;

const SCROLL_BYTE = 2; // +2 field of each 3-byte object descriptor
const COUNTER_A_STAMP = 80;
const COUNTER_B_FLOOR = 160;
const PHASE_LANE_A = 16;
const PHASE_LANE_B = 32;
const PHASE_LANE_C = 48;

export function loc_2005(m) {
  const { mem8 } = m;

  mem8[loc_811a] = mem8[(loc_8273 + SCROLL_BYTE) & 0xffff];
  const a = (mem8[loc_8110] + 1) & 0xff;
  mem8[loc_8110] = a;
  if (a >= COUNTER_A_STAMP) stampScrollRevealColumn(m);

  mem8[loc_8119] = mem8[(loc_827c + SCROLL_BYTE) & 0xffff];
  const b = (mem8[loc_8111] + 2) & 0xff;
  mem8[loc_8111] = b;
  if (b < COUNTER_B_FLOOR) blitScrollBand(m);

  const phase = (mem8[loc_826e] + 1) & 0xff;
  mem8[loc_826e] = phase;
  if (phase === PHASE_LANE_A) return stampLanes(m, loc_1423, loc_145f, false);
  if (phase === PHASE_LANE_B) return stampLanes(m, loc_142b, loc_1473, false);
  if (phase === PHASE_LANE_C) return stampLanes(m, loc_1433, loc_1487, true);
}

// Feed object A's descriptor into the grid copy engine, then object B's into the alt-base engine;
// the wrapping phase (48) also clears the phase counter before the copy.
function stampLanes(m, gridSource, bandSource, wrapPhase) {
  const { regs, mem8 } = m;

  regs.b = mem8[(loc_8273 + 1) & 0xffff];
  regs.c = mem8[loc_811a];
  regs.de = gridSource;
  mem8[loc_81b1] = mem8[loc_8273];
  if (wrapPhase) mem8[loc_826e] = 0;
  blitScrollTileGrid(m);

  regs.b = mem8[(loc_827c + 1) & 0xffff];
  regs.c = mem8[loc_8119];
  regs.de = bandSource;
  mem8[loc_81b1] = mem8[loc_827c];
  return m.call(COPY_SCROLL_GRID_ALT);
}
