// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFire — advance ONE fire by one frame: step it along the heading its state carries, let
 * its timer reroll that heading when it expires, and publish the working position into the drawn
 * position.
 *
 * The fire's record arrives through OBJ_ITER_PTR (the walk stores it there before entering), and
 * callees read it back from the machine's record register, so it is deliberately RE-READ at three
 * points because a callee may have moved it on.
 *
 * Three things happen, in order:
 *   1. ROUTING. A record with OBJ_INSERT_REQUESTED == 1 belongs to the insert walker and nothing
 *      else runs. Otherwise a LOW-side record gets one of two timer ticks (chosen by a record
 *      field); the second, on a pass with the low two bits of RANDOM clear, goes on to the
 *      heading/collision state machine — the timer decides a reroll is due, the RANDOM gate keeps
 *      rerolls off a fixed cadence. A state back at 0 skips to step 3.
 *   2. MOVEMENT. HIGH side runs the animation/step-counter arm. LOW side steps the working X one
 *      pixel per OBJ_STATE, then judges the tile below: out of band -> step UNDONE and heading
 *      reversed; in band, only the two X edges re-arm it.
 *   3. PUBLISH. Working X -> OBJ_X unchanged; working Y plus a table byte -> OBJ_Y, the table
 *      indexed by a record field that counts DOWN and reloads at 0. What the table holds (and so
 *      what the index selects) is not established.
 *
 * There is no loop, array walk or slot selection here — a per-object body, not a service.
 *
 * LIVE-OUT: memory-only, plus the void return.
 */

import { u8 } from "../../../core/int.js";
import {
  FIRE_STATE_MACHINE_RETURN,
  FIRE_Y_OFFSET_TABLE,
  OBJ_INSERT_REQUESTED,
  OBJ_ITER_PTR,
  OBJ_STATE,
  OBJ_X,
  OBJ_Y,
  RANDOM,
} from "./names.js";
import { turnFireAtGroundEdge } from "./turnFireAtGroundEdge.js";
import { loc_32bd } from "./loc_32bd.js";
import { loc_32d6 } from "./loc_32d6.js";
import { tickFireTimerAndRerollDirection } from "./tickFireTimerAndRerollDirection.js";
import { walkFireOneStep } from "./walkFireOneStep.js";
import { settleFireOnGirderSlope } from "./settleFireOnGirderSlope.js";
import { loc_33e7 } from "./loc_33e7.js";

// Record fields with no shared name; kept as local offsets.
const OBJ_WORKING_X = 0x0e;
const OBJ_WORKING_Y = 0x0f;
const OBJ_Y_OFFSET_INDEX = 0x13; // index into the Y-offset table; counts down, reloads at 0
const OBJ_TIMER_KIND = 0x19;     // selects which of the two timer ticks runs

const Y_OFFSET_INDEX_RELOAD = 17;

// Headings the state field carries: state 1 steps the working X up, everything else steps it down.
const TRAVEL_X_UP = 1;
const TRAVEL_X_DOWN = 2;

// The two X positions that re-arm the heading: below the low edge sends the fire back up, at or
// above the high edge sends it back down.
const X_LOW_EDGE = 16;
const X_HIGH_EDGE = 240;

// High/low split: bit 7 of (state - 4), so 4..131 are high and 0..3 with 132..255 are low.
const isHighState = (state) => (u8(state - 4) & 0x80) === 0;

// The return bracket the heading/collision state machine consumes; pushed by hand because two of
// that routine's callees can return by unwinding PAST it, straight back to here.

/**
 * @param {object} m  the machine. The record pointer arrives in memory, not a register.
 * @returns {void}
 */
export function advanceFire(m) {
  const { regs, mem8, mem16 } = m;

  const loadRecord = () => { regs.ix = mem16[OBJ_ITER_PTR]; };
  const field = (off) => (regs.ix + off) & 0xffff;

  // Step 3: publish the working position into the drawn position, and step the table index.
  function publishPosition() {
    const index = mem8[field(OBJ_Y_OFFSET_INDEX)];
    const next = index === 0 ? Y_OFFSET_INDEX_RELOAD : index - 1;

    mem8[field(OBJ_Y_OFFSET_INDEX)] = next;
    mem8[field(OBJ_X)] = mem8[field(OBJ_WORKING_X)];
    mem8[field(OBJ_Y)] = mem8[FIRE_Y_OFFSET_TABLE + next] + mem8[field(OBJ_WORKING_Y)];
  }

  // The step was refused: undo the pixel just taken, reverse the heading, then let the girder-slope
  // tail re-snap the working Y under the new X.
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
      // Only a pass with the low two bits of RANDOM clear may reach the state machine.
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

  // The heading/collision state machine, dispatched by address. Two of its callees return by
  // unwinding past it to this exact point, so the call bracket is pushed by hand and execution
  // continues here whether it finished or bailed.
  m.push16(FIRE_STATE_MACHINE_RETURN);
  m.call(0x333d);

  stepMovement();
}
