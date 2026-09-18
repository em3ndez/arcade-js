// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveFireLadderClimb — switch one fire between walking a girder and climbing a ladder. It never
 * moves the fire; it only picks a destination height and a direction. OBJ_STATE selects the half:
 * a walking state runs the on-foot decision, an ascend/descend state watches for arrival.
 *
 * On foot: a height guard runs first (on the lower boards it abandons the climb once the fire has
 * risen past its line; the top board always proceeds). The fire's X keys a pair of ladder-end
 * heights and the lookup returns the one it is NOT on — the far slot sends it up, the near slot
 * down. Ascent is unconditional; descent is taken only while the fire is above Mario's row.
 *
 * Travelling: both states poll the biased Y base against the destination and drop to on-foot on
 * the nose. They differ only in that an ascent, and only with RECORD_MODE 2, raises the arrival
 * mark. RECORD_MODE and the mark's meaning are open.
 * LIVE-OUT: memory only (the three record bytes); no register or flag survives, record pointer
 * left alone.
 */

import { u8 } from "../../../core/int.js";
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
  const at = (offset) => (recordBase + offset) & 0xffff;

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

  regs.d = u8(mem8[at(RECORD_Y_BASE)] + Y_BASE_BIAS);
  regs.a = mem8[at(RECORD_X)];
  regs.bc = TABLE_ENTRIES;
  if (!findOppositeLadderEnd(m)) return; // this X is paired with no heights

  const standingOnFarSlot = regs.a === 0;
  mem8[at(RECORD_DESTINATION)] = regs.b;

  if (standingOnFarSlot) {
    mem8[at(OBJ_STATE)] = STATE_ASCEND;
    return;
  }
  // Descent only from above Mario, never from level with him or below.
  if (mem8[at(RECORD_Y_BASE)] >= mem8[MARIO_Y]) return;
  mem8[at(OBJ_STATE)] = STATE_DESCEND;
}
