// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveFireLadderClimb — drive one fire's climb up or down a ladder: while it is on foot, decide
 * whether to set off for the other of the two heights its X is keyed to; while it is travelling,
 * watch for arrival.
 *
 * The fire's OBJ_STATE picks which half runs, and what those state values mean is fixed by the
 * routines that MOVE the fire, not by this one:
 *
 *   STATE_ON_FOOT (and its two walking siblings) — the fire is on a girder, and the walker steps
 *     its working X one pixel a frame
 *   STATE_DESCEND / STATE_ASCEND — the fire is on a ladder, and the vertical mover steps its Y
 *     base instead, down the screen in one state and up in the other
 *
 * So this routine is the SWITCH between walking and climbing. It never moves the fire itself; it
 * only chooses a destination and a direction.
 *
 * SETTING OFF (the on-foot half). A guard runs first, and its height line is the one thing that
 * stops this routine: on the three lower boards a fire that has risen above that line abandons the
 * climb decision outright, while on the top board the height test does not apply at all and the
 * routine always proceeds. Past the guard the fire's X is looked up in the type-0 object table,
 * whose entries pair each key with TWO bytes; the discriminator handed to the lookup is the fire's
 * own Y base, so the pair is a pair of LADDER-END HEIGHTS and the lookup returns whichever one the
 * fire is NOT standing on. That byte becomes RECORD_DESTINATION and the tag becomes the direction:
 * from the far slot the fire goes up, from the near slot it goes down — which is what makes the
 * near slot of a pair the higher of the two. The descent is conditional where the ascent is not:
 * it is taken only while the fire's Y base is ABOVE Mario's row (smaller Y is higher on screen),
 * so a fire already level with Mario or below him never sets off downward.
 *
 * ARRIVING (the travelling half). Both travel states poll the same way — the Y base, biased by
 * Y_BASE_BIAS, against the stored destination — and both drop back to STATE_ON_FOOT on the nose.
 * They differ in exactly one thing: the ASCENT alone, and only when RECORD_MODE holds 2, raises
 * RECORD_ARRIVAL_MARK. That single asymmetry is the whole difference between the two arms.
 *
 * OPEN, and deliberately not guessed at: what the bias measures from (it is applied identically
 * when forming the discriminator and when testing for arrival, so it cancels between them), and
 * what RECORD_MODE and RECORD_ARRIVAL_MARK select — 2 is a distinguished value of the mode byte
 * elsewhere too, but nothing here says what it distinguishes.
 *
 * LIVE-OUT: memory only — the three record bytes it can write. No register and no flag survives,
 * and the record pointer is left alone.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_Y, OBJ_STATE } from "./names.js";
import { loc_33a1 } from "./loc_33a1.js"; // the board gate + height guard
import { findOppositeLadderEnd } from "./findOppositeLadderEnd.js"; // the keyed lookup that returns the other of a pair

// Fire-record fields with no registered name. The two coordinates are the fire's two axes: the
// walker steps the working X, the guard and this routine test the Y base.
const RECORD_X = 0x0e;
const RECORD_Y_BASE = 0x0f;
const RECORD_MODE = 0x19; // meaning open; only the value 2 is distinguished here
const RECORD_ARRIVAL_MARK = 0x1d; // raised on an ascent's arrival when the mode byte holds 2
const RECORD_DESTINATION = 0x1f; // the biased height this climb ends at

// The OBJ_STATE values this routine reads and writes. Walking spans three values; it writes only 0.
const STATE_ON_FOOT = 0;
const STATE_DESCEND = 4;
const STATE_ASCEND = 8;

// The Y base is offset by this much everywhere it is compared against a table height, both when
// asking which height to head for and when asking whether the fire has got there.
const Y_BASE_BIAS = 8;

// How far into the type-0 object table the key may be looked for.
const TABLE_ENTRIES = 21;

/**
 * @param {object} m  the machine.
 * @param {number} recordBase  the fire record to run, which arrives in the machine's record
 *   pointer. It must equal that pointer: the guard re-reads the pointer from the machine to run
 *   its own height test on the same record, and the lookup takes its inputs in registers.
 */
export function driveFireLadderClimb(m, recordBase = m.regs.ix /* the caller hands the record over in a register */) {
  const { regs, mem8 } = m;
  const at = (offset) => (recordBase + offset) & 0xffff;

  const state = mem8[at(OBJ_STATE)];

  // -- travelling: there is nothing to do until the Y base lands exactly on the destination --
  if (state === STATE_ASCEND || state === STATE_DESCEND) {
    if (u8(mem8[at(RECORD_Y_BASE)] + Y_BASE_BIAS) !== mem8[at(RECORD_DESTINATION)]) return;
    mem8[at(OBJ_STATE)] = STATE_ON_FOOT;
    // The one thing that separates the two travel states: only an ascent marks its arrival.
    if (state === STATE_ASCEND && mem8[at(RECORD_MODE)] === 2) mem8[at(RECORD_ARRIVAL_MARK)] = 1;
    return;
  }

  // -- on foot: a fire that has risen above the guard's height line abandons this routine --
  if (!loc_33a1(m)) return;

  regs.d = u8(mem8[at(RECORD_Y_BASE)] + Y_BASE_BIAS); // the height the fire is standing at
  regs.a = mem8[at(RECORD_X)]; // which pair of heights to look up
  regs.bc = TABLE_ENTRIES;
  if (!findOppositeLadderEnd(m)) return; // this X is paired with no heights — nothing to set off for

  const standingOnFarSlot = regs.a === 0; // the tag: which of the pair the fire was on
  mem8[at(RECORD_DESTINATION)] = regs.b; // and the byte handed back is always the other one

  if (standingOnFarSlot) {
    mem8[at(OBJ_STATE)] = STATE_ASCEND;
    return;
  }
  // Setting off downward is conditional: only from above Mario, never from level with him or below.
  if (mem8[at(RECORD_Y_BASE)] >= mem8[MARIO_Y]) return;
  mem8[at(OBJ_STATE)] = STATE_DESCEND;
}
