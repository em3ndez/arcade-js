// SPDX-License-Identifier: GPL-3.0-only
// Deactivate the object at IX and raise a sound/score request. Scans three bands of the object's packed
// field against a threshold; each miss bumps the request param and drops the field by 16, and a matched
// band enqueues immediately. On exhaust it raises the inhibit/request word, folds in a neighbour bonus
// when the active-neighbour count is exactly two, records the bonus, and enqueues the folded request.
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { bumpCountIfNeighborsInactive } from "./bumpCountIfNeighborsInactive.js";
import { loc_422b, ACTIVE_NEIGHBOR_COUNT, loc_422d } from "./names.js";

const REQUEST_HI = 3;       // high byte of the enqueued request word
const THRESHOLD = 0x50;     // band threshold
const BANDS = 3;
const BAND_STEP = 16;       // field drop per missed band
const NEIGHBOR_BONUS_AT = 2; // fold the neighbour bonus only at this active-neighbour count
const INHIBIT_REQUEST_WORD = (0xf0 << 8) | 1; // stored little-endian; also the restored ptr in HL

export function loc_125e(m, obj = m.regs.ix) {
  const { mem8, mem16 } = m;

  // Deactivate the object.
  mem8[obj + 0] = 0;
  mem8[obj + 1] = 1;
  mem8[obj + 2] = 0;

  // Band scan (param seed 4, bumped per miss).
  let param = 4;
  let field = mem8[obj + 7];
  for (let b = 0; b < BANDS; b++) {
    if (field < THRESHOLD) return enqueueCommandWord(m, (REQUEST_HI << 8) | param);
    param = (param + 1) & 0xff;
    field = (field - BAND_STEP) & 0xff;
  }

  // Exhausted: raise the inhibit word, fold the neighbour bonus, record it, enqueue the folded request.
  mem16[loc_422b] = INHIBIT_REQUEST_WORD;
  let bonus = mem8[ACTIVE_NEIGHBOR_COUNT];
  if (bonus === NEIGHBOR_BONUS_AT) bonus = bumpCountIfNeighborsInactive(m, bonus, obj);
  mem8[loc_422d] = bonus;
  const folded = (bonus + param) & 0xff;
  return enqueueCommandWord(m, (REQUEST_HI << 8) | folded, INHIBIT_REQUEST_WORD);
}
