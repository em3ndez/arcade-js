// SPDX-License-Identifier: GPL-3.0-only
/** destroyTargetsHitByShots — destroy every target a live shot has reached, and post the score for each one.
 *
 * A run of shot slots is swept against a run of target slots. A shot whose state byte does not
 * hold the live code is passed over entirely. A live one is tested against every target in the
 * run: the target must itself be live, neither of its two coordinates may lie in the narrow band
 * around zero that an unplaced or retired slot leaves behind, and both must fall inside a box
 * centred on the shot — one half-width and one width, from the caller, shared by both axes.
 * A target that passes is destroyed together with the shot that reached it: both state bytes take
 * the same destroyed code and the chained hit score is posted for that single kill. The sweep
 * does NOT stop there, so one shot can take several targets in one pass and is paid for each.
 * The two coordinate sources are parallel tables read at different strides: the shot keeps its
 * whole-part coordinates inside its own record, the target keeps them in a two-byte entry whose
 * halves sit 49 apart. Between passes the target cursors are RELOADED from two fixed cells and
 * the inner count from the shadow accumulator; none of the three is carried on, so every shot
 * starts the same run over.
 * LIVE-OUT: memory only. */

import { u8, u16 } from "../../../core/int.js";
import { postChainedHitScore } from "./postChainedHitScore.js";
import { SCRATCH_PTR_A, SCRATCH_PTR_B } from "./names.js";

const STATE = 0;
const SHOT_FIRST_AXIS = 6;
const SHOT_SECOND_AXIS = 4;
const ENTRY_SECOND_AXIS = 49;
const LIVE = 255;
const DESTROYED = 240;
const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

// A coordinate this close to zero is not a position yet: on the first axis the 8 values below
// zero through the 16 above it, on the second the 16 below zero and zero itself.
const FIRST_AXIS_LEAD = 8;
const FIRST_AXIS_BAND = 25;
const SECOND_AXIS_LEAD = 16;
const SECOND_AXIS_BAND = 17;

/** Two coordinates are close enough when their wrapped difference lands inside the box. */
const within = (a, b, reach, span) => u8(u8(a - b) + reach) < span;

/** Advance a cursor a whole record on WITHOUT leaving its page — the carry is dropped. */
const nextRecord = (cursor) => (cursor & 0xff00) | u8(cursor + RECORD_STRIDE);

function reached(mem8, shot, entry, target, reach, span) {
  if (mem8[target + STATE] !== LIVE) return false;
  const first = mem8[entry];
  if (u8(first + FIRST_AXIS_LEAD) < FIRST_AXIS_BAND) return false;
  const second = mem8[entry + ENTRY_SECOND_AXIS];
  if (u8(second + SECOND_AXIS_LEAD) < SECOND_AXIS_BAND) return false;
  return (
    within(mem8[shot + SHOT_FIRST_AXIS], first, reach, span) &&
    within(mem8[shot + SHOT_SECOND_AXIS], second, reach, span)
  );
}

export function destroyTargetsHitByShots(
  m,
  shot = m.regs.ix,
  entry = m.regs.iy,
  target = m.regs.de,
  targetsFirstPass = m.regs.b,
  targetsPerPass = m.regs.a_,
  shots = m.regs.c,
  reach = m.regs.l,
  span = m.regs.h,
) {
  const { mem8, mem16 } = m;
  let shotSlot = shot;
  let entryCursor = entry;
  let targetCursor = target;
  let targets = targetsFirstPass;
  let shotsLeft = shots;

  do {
    if (mem8[shotSlot + STATE] === LIVE) {
      let left = targets;
      do {
        if (reached(mem8, shotSlot, entryCursor, targetCursor, reach, span)) {
          mem8[shotSlot + STATE] = DESTROYED;
          mem8[targetCursor + STATE] = DESTROYED;
          postChainedHitScore(m);
        }
        entryCursor = u16(entryCursor + ENTRY_STRIDE);
        targetCursor = nextRecord(targetCursor);
        left = u8(left - 1);
      } while (left !== 0);
    }
    entryCursor = mem16[SCRATCH_PTR_A];
    targetCursor = mem16[SCRATCH_PTR_B];
    targets = targetsPerPass;
    shotSlot = nextRecord(shotSlot);
    shotsLeft = u8(shotsLeft - 1);
  } while (shotsLeft !== 0);
}
