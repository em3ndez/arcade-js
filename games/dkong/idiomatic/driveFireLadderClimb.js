// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveFireLadderClimb — switch one fire between walking a girder and climbing a ladder; it never
 * moves the fire, only picks a destination height and direction. OBJ_STATE selects the half.
 * On foot: a height guard runs first (lower boards abandon once risen past the line; top proceeds).
 * The fire's X keys a pair of ladder-end heights; the lookup returns the one it is NOT on (far slot
 * up, near slot down). Ascent is unconditional; descent only while above Mario's row.
 * Travelling: both states poll the biased Y base against the destination and drop to on-foot on the
 * nose, differing only in that an ascent with RECORD_MODE 2 raises the arrival mark.
 * LIVE-OUT: memory only (the three record bytes).
 */

import { u8, u16 } from "../../../core/int.js";
import { MARIO_Y, OBJ_STATE } from "./names.js";
import { loc_33a1 } from "./loc_33a1.js";
import { findOppositeLadderEnd } from "./findOppositeLadderEnd.js";

// Unnamed fire-record fields (offsets from the record base).
const RECORD_X = 0x0e;
const RECORD_Y_BASE = 0x0f;
const RECORD_MODE = 0x19;
const RECORD_ARRIVAL_MARK = 0x1d;
const RECORD_DESTINATION = 0x1f;

const STATE_ON_FOOT = 0;
const STATE_DESCEND = 4;
const STATE_ASCEND = 8;

const Y_BASE_BIAS = 8;
const TABLE_ENTRIES = 21;

/**
 * @param {object} m  the machine.
 * @param {number} recordBase  the fire record to run; must equal the machine's record pointer,
 *   which the guard re-reads to test the same record.
 */
export function driveFireLadderClimb(m, recordBase = m.regs.ix) {
  const { regs, mem8 } = m;
  const at = (offset) => u16(recordBase + offset);

  const state = mem8[at(OBJ_STATE)];

  // Travelling: nothing to do until the Y base lands exactly on the destination.
  if (state === STATE_ASCEND || state === STATE_DESCEND) {
    if (u8(mem8[at(RECORD_Y_BASE)] + Y_BASE_BIAS) !== mem8[at(RECORD_DESTINATION)]) return;
    mem8[at(OBJ_STATE)] = STATE_ON_FOOT;
    // The one asymmetry: only an ascent marks its arrival.
    if (state === STATE_ASCEND && mem8[at(RECORD_MODE)] === 2) mem8[at(RECORD_ARRIVAL_MARK)] = 1;
    return;
  }

  // On foot: a fire that has risen above the guard's height line abandons this routine.
  if (!loc_33a1(m)) return;

  // live-in: key = X, disc = biased Y base, count = table entries.
  const yBiased = u8(mem8[at(RECORD_Y_BASE)] + Y_BASE_BIAS);
  if (!findOppositeLadderEnd(m, mem8[at(RECORD_X)], yBiased, TABLE_ENTRIES)) return;

  const standingOnFarSlot = regs.a === 0; // end tag returned in A
  mem8[at(RECORD_DESTINATION)] = regs.b; // opposite height returned in B

  if (standingOnFarSlot) {
    mem8[at(OBJ_STATE)] = STATE_ASCEND;
    return;
  }
  // Descent only from above Mario, never from level with him or below.
  if (mem8[at(RECORD_Y_BASE)] >= mem8[MARIO_Y]) return;
  mem8[at(OBJ_STATE)] = STATE_DESCEND;
}
