// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFire — advance ONE fire by one frame: step it along the heading its state carries, let
 * its timer reroll that heading when it expires, and publish the working position it ends up at
 * into the position that is actually drawn.
 *
 * The fire's record is handed over through OBJ_ITER_PTR rather than as an argument — the walk
 * stores the pointer there and then enters here, and every callee below reads it back out of the
 * machine, so it is held in the machine's record register. It is deliberately RE-READ at three
 * points, because a callee may have moved it on.
 *
 * THREE THINGS HAPPEN, IN ORDER.
 *
 *   1. ROUTING. A record whose OBJ_INSERT_REQUESTED is 1 is not a live fire yet — it belongs to
 *      the board-keyed insert walker, which takes it and nothing else here runs. Otherwise a
 *      record on the LOW side of the state split gets one of two timer ticks first, chosen by a
 *      record field; only the second of those, and only on a pass that finds the low two bits of
 *      RANDOM clear, goes on to the heading/collision state machine. THIS IS THE REROLL: the
 *      timer tick is what decides a new heading is due, and the RANDOM gate is what keeps the
 *      rerolls from happening on a fixed cadence. A state that has come back to 0 has nothing to
 *      move and skips straight to step 3.
 *   2. MOVEMENT. On the HIGH side of the split the animation-and-step-counter arm runs. On the
 *      low side the working X is stepped ONE pixel the way OBJ_STATE points, and the tile 12 px
 *      BELOW the new position is then judged: out of band and the step is UNDONE and the heading
 *      reversed; in band and only the two X edges can re-arm it — below the low edge the fire is
 *      sent back up, at or above the high edge back down.
 *   3. PUBLISH. The working coordinates become the drawn ones. OBJ_X takes the working X
 *      unchanged; OBJ_Y takes the working Y PLUS one byte fetched from a table, indexed by a
 *      record field that counts DOWN every pass and reloads when it reaches 0.
 *
 * WHAT THE NAME RESTS ON, from this body alone: everything here is one record's motion for one
 * frame — a single-pixel step, an undo-and-reverse when the step is refused, and a timer that
 * changes the heading rather than the speed. There is no loop, no array walk and no slot
 * selection anywhere in it, which is what separates a per-object body from a service.
 *
 * NOT CLAIMED: what the Y-offset table holds, and therefore what the counting-down index selects
 * — only that its byte is added to the working Y on the way to the drawn Y.
 *
 * Reads OBJ_ITER_PTR and RANDOM, and from the record OBJ_INSERT_REQUESTED, OBJ_STATE, the working
 * X and Y, and the Y-offset index. Writes the record's OBJ_STATE, working X, Y-offset index,
 * OBJ_X and OBJ_Y; everything else it changes, it changes through a callee.
 *
 * LIVE-OUT: memory-only, plus the void return.
 */

import { u8 } from "../../../core/int.js";
import {
  OBJ_INSERT_REQUESTED, OBJ_ITER_PTR, OBJ_STATE, OBJ_X, OBJ_Y, RANDOM,
} from "./names.js";
import { turnFireAtGroundEdge } from "./turnFireAtGroundEdge.js";   // is the ground below the fire at its edge?
import { loc_32bd } from "./loc_32bd.js";   // board-keyed insert walker
import { loc_32d6 } from "./loc_32d6.js";   // interval down-counter + periodic tick
import { tickFireTimerAndRerollDirection } from "./tickFireTimerAndRerollDirection.js";
import { walkFireOneStep } from "./walkFireOneStep.js";   // one-pixel X step + sprite/animation work
import { settleFireOnGirderSlope } from "./settleFireOnGirderSlope.js";   // girder-slope re-snap
import { loc_33e7 } from "./loc_33e7.js";   // animation step + step-counter nudge

// Record fields with no shared name; kept as local offsets.
const OBJ_WORKING_X = 0x0e;      // working X, published to OBJ_X below
const OBJ_WORKING_Y = 0x0f;      // working Y, published to OBJ_Y below
const OBJ_Y_OFFSET_INDEX = 0x13; // index into the Y-offset table; counts down, reloads at 0
const OBJ_TIMER_KIND = 0x19;     // selects which of the two timer ticks runs

// The table whose byte is added to the working Y to make the drawn OBJ_Y. What the table holds,
// and so what the index above selects, is not established.
const Y_OFFSET_TABLE = 0x3a7a;
const Y_OFFSET_INDEX_RELOAD = 17;

// Headings the state field carries on this array: state 1 steps the working X up, everything
// else steps it down.
const TRAVEL_X_UP = 1;
const TRAVEL_X_DOWN = 2;

// The two X positions that re-arm the heading: below the low edge the fire is sent back up, at
// or above the high edge it is sent back down.
const X_LOW_EDGE = 16;
const X_HIGH_EDGE = 240;

// The high/low split on the state field is a test of bit 7 of (state - 4), so states 4..131 count
// as high and 0..3 together with 132..255 count as low. Written at full byte width rather than
// narrowed to the small set of states this array is actually grounded on.
const isHighState = (state) => (u8(state - 4) & 0x80) === 0;

// The return bracket the heading/collision state machine consumes. It is pushed by hand because
// two of that routine's own callees can return by unwinding PAST it, straight back to here.
const RETURN_FROM_STATE_MACHINE = 0x3233;

/**
 * @param {object} m  the machine. The record pointer arrives in memory, not in a register, so
 *                    there is no register live-in to promote to a parameter.
 * @returns {void}
 */
export function advanceFire(m) {
  const { regs, mem8, mem16 } = m;

  // The record the walk is pointing at. Held in the machine's record register because the callees
  // below take it from there rather than as an argument.
  const loadRecord = () => { regs.ix = mem16[OBJ_ITER_PTR]; };
  const field = (off) => (regs.ix + off) & 0xffff;

  // Step 3: publish the working position into the drawn position, and step the table index.
  function publishPosition() {
    const index = mem8[field(OBJ_Y_OFFSET_INDEX)];
    const next = index === 0 ? Y_OFFSET_INDEX_RELOAD : index - 1;

    mem8[field(OBJ_Y_OFFSET_INDEX)] = next;
    mem8[field(OBJ_X)] = mem8[field(OBJ_WORKING_X)];
    mem8[field(OBJ_Y)] = mem8[Y_OFFSET_TABLE + next] + mem8[field(OBJ_WORKING_Y)];
  }

  // The step was refused: undo the pixel just taken and reverse the heading, then let the
  // girder-slope tail re-snap the working Y under the new X.
  function reverseTravel() {
    loadRecord();
    if (mem8[field(OBJ_STATE)] === TRAVEL_X_UP) {
      mem8[field(OBJ_WORKING_X)] = mem8[field(OBJ_WORKING_X)] - 1;
      mem8[field(OBJ_STATE)] = TRAVEL_X_DOWN;
    } else {
      mem8[field(OBJ_WORKING_X)] = mem8[field(OBJ_WORKING_X)] + 1;
      mem8[field(OBJ_STATE)] = TRAVEL_X_UP;
    }
    settleFireOnGirderSlope(m);
    publishPosition();
  }

  // Step 2: the movement update — every routing path that has not already returned ends here.
  function stepMovement() {
    if (isHighState(mem8[field(OBJ_STATE)])) {
      loc_33e7(m);
      publishPosition();
      return;
    }

    // One pixel along, then judge the tile the fire is now heading into.
    walkFireOneStep(m);
    if (turnFireAtGroundEdge(m)) {
      reverseTravel();
      return;
    }

    // Accepted. Only the two X edges can re-arm the heading from here.
    loadRecord();
    const workingX = mem8[field(OBJ_WORKING_X)];
    if (workingX < X_LOW_EDGE) mem8[field(OBJ_STATE)] = TRAVEL_X_UP;
    else if (workingX >= X_HIGH_EDGE) mem8[field(OBJ_STATE)] = TRAVEL_X_DOWN;
    publishPosition();
  }

  // Step 1: routing.
  loadRecord();

  // A record still waiting to be inserted is the walker's business only.
  if (mem8[field(OBJ_INSERT_REQUESTED)] === 1) {
    loc_32bd(m);
    return;
  }

  if (!isHighState(mem8[field(OBJ_STATE)])) {
    if (mem8[field(OBJ_TIMER_KIND)] === 2) {
      loc_32d6(m);
    } else {
      tickFireTimerAndRerollDirection(m);
      // Only a pass that finds the low two bits of RANDOM clear may reach the state machine;
      // every other pass goes straight on to the movement update.
      if ((mem8[RANDOM] & 0x03) !== 0) {
        stepMovement();
        return;
      }
    }

    // Both timer ticks can reset the state to 0, and a fire back at 0 has nothing to move.
    if (mem8[field(OBJ_STATE)] === 0) {
      publishPosition();
      return;
    }
  }

  // The heading/collision state machine, dispatched by address. It has two callees that return by
  // unwinding past it to this exact point, so the call bracket is pushed by hand and execution
  // continues here whether it finished or bailed — either way the state read below is as it left it.
  m.push16(RETURN_FROM_STATE_MACHINE);
  m.call(0x333d);

  stepMovement();
}
