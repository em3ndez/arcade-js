// SPDX-License-Identifier: GPL-3.0-only
/**
 * scoreFrogRowProgress — award a point when the frog reaches a new furthest row (a smaller row climbs).
 * Range-checks the row to [0x30,0xd0]; the 0xd0 edge seeds a zero high-water mark above-band so it scores.
 * A row nearer the top updates the mark and awards the delta via the score routine, bar the mid row 0x80.
 * LIVE-OUT: memory-only.
 */
import { FROG_Y, FROG_FURTHEST_ROW } from "./names.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";

const ROW_MIN = 0x30, ROW_MAX = 0xd0, ROW_MID = 0x80, SEED_ABOVE_BAND = 0xe0;
const PROGRESS_DELTA = 0x0001;

export function scoreFrogRowProgress(m) {
  const { regs, mem8 } = m;
  const row = mem8[FROG_Y];
  if (row < ROW_MIN || row > ROW_MAX) return;
  if (row === ROW_MAX && mem8[FROG_FURTHEST_ROW] === 0) mem8[FROG_FURTHEST_ROW] = SEED_ABOVE_BAND;
  const furthest = mem8[FROG_FURTHEST_ROW];
  if (furthest <= row) return; // not nearer the top than the record
  mem8[FROG_FURTHEST_ROW] = row;
  regs.de = PROGRESS_DELTA;
  if (row === ROW_MID) return; // the mid row awards nothing
  addScoreAndAwardExtraLife(m);
}
