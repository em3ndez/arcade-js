// SPDX-License-Identifier: GPL-3.0-only
/** destroyTargetsReachedByFixedAttacker — destroy every target ONE fixed attacker has reached, and post the score for each.
 *
 * The attacker is not a parameter: its state byte and its two screen coordinates live at fixed
 * cells, so this sweeps a caller's run of target slots against that one object. It returns at
 * once unless the attacker's state byte holds the live code. Otherwise every slot of the run is
 * tested: the target must itself be live, and both of its coordinates must fall inside a box
 * centred on the attacker — one half-width and one width, from the caller, shared by both axes
 * and measured as a wrapped distance. A target that passes is destroyed together with the
 * attacker, both state bytes taking the same destroyed code, and the chained hit score is posted
 * for that single kill. The sweep does NOT stop there and does not re-read the attacker's state,
 * so one attacker can take several targets in one pass and is paid for each. The record cursor
 * advances a record at a time WITHOUT leaving its page; the entry cursor advances a stride.
 * LIVE-OUT: memory, plus the two cursors left where the sweep ended. */

import { u8, u16 } from "../../../core/int.js";
import { postChainedHitScore } from "./postChainedHitScore.js";
import { PLAYER_ENTRY, PLAYER_STATE } from "./names.js";

const STATE = 0;
const LIVE = 255;
const DESTROYED = 240;
const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;
const ENTRY_SECOND_AXIS = 49;


/** Two coordinates are close enough when their wrapped difference lands inside the box. */
const within = (a, b, reach, span) => u8(u8(a - b) + reach) < span;

/** Advance a cursor a whole record on WITHOUT leaving its page — the carry is dropped. */
const nextRecord = (cursor) => (cursor & 0xff00) | u8(cursor + RECORD_STRIDE);

export function destroyTargetsReachedByFixedAttacker(
  m,
  target = m.regs.de,
  entry = m.regs.iy,
  targets = m.regs.b,
  reach = m.regs.l,
  span = m.regs.h,
) {
  const { mem8, regs } = m;
  if (mem8[PLAYER_STATE] !== LIVE) return;

  let targetCursor = target;
  let entryCursor = entry;
  let left = targets;
  do {
    if (
      mem8[targetCursor + STATE] === LIVE &&
      within(mem8[PLAYER_ENTRY], mem8[entryCursor], reach, span) &&
      within(
        mem8[PLAYER_ENTRY + ENTRY_SECOND_AXIS],
        mem8[entryCursor + ENTRY_SECOND_AXIS],
        reach,
        span,
      )
    ) {
      mem8[PLAYER_STATE] = DESTROYED;
      mem8[targetCursor + STATE] = DESTROYED;
      postChainedHitScore(m);
    }
    entryCursor = u16(entryCursor + ENTRY_STRIDE);
    targetCursor = nextRecord(targetCursor);
    left = u8(left - 1);
  } while (left !== 0);

  regs.de = targetCursor;
  regs.iy = entryCursor;
}
