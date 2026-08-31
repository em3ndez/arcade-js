// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { tickPhaseTimerAndMaybeRunResetScan } from "./tickPhaseTimerAndMaybeRunResetScan.js";
import { advanceRisingActorStep } from "./advanceRisingActorStep.js";
import { advanceLeadActorDescentToLanding } from "./advanceLeadActorDescentToLanding.js";
import {
  FORMATION_SPAWN_TIMER,
  FIELD_ATTRIB_SRC_B,
  FIELD_ATTRIB_SRC_C,
  FIELD_ATTRIB_REF_2980,
  DESCENT_STATE_COMPLETE_DISPLAY_CMD,
  loc_8343,
} from "./names.js";
/**
 * Descent state handler for the actor record at IX.
 *
 * Reseats the frame-hold and, every fourth frame, toggles the display tile between its two
 * shapes. It then drives the descent counter down by two: while it stays at or above the floor
 * the handler just returns. Below the floor, a set gate byte diverts into the countdown/redirect
 * step; otherwise it reseeds the spawn timer, stretches the frame-hold, advances the record
 * state, and runs two self-checks — a running-sum over one attribute block and a byte compare
 * of a second block against its reference table. A sum miss diverts to the state-6 handler and a
 * compare miss to the state-0 handler; a clean pair enqueues the descent display command.
 *
 * SEATING: BALANCED (its own plain rets WIRE); the three diversions are tail-jumps that forward
 * the delegatee's result. LIVE-OUT: none of its own.
 */

const FRAME_HOLD = 0x11; //    record offsets
const ANIM_TICK = 0x0b;
const DISPLAY_TILE = 0x0f;
const DESCENT_COUNTER = 0x06;
const STATE_FIELD = 0x02;

const FRAME_HOLD_SHORT = 0x03; // reseed on the common path
const FRAME_HOLD_LONG = 0x18; //  reseed once the floor is reached
const TICK_MASK = 0x03; //        toggle the tile every fourth frame
const TILE_A = 0x15; //           the two display-tile shapes
const TILE_B = 0x1e;
const DESCENT_STEP = 0x02; //     counter drops by this each frame
const DESCENT_FLOOR = 0x2c; //    at/above this the handler just returns
const SPAWN_TIMER_BASE = 0x30; // spawn-timer reseed base (gate byte is 0 here)
const CKSUM_LEN = 0x20; //        bytes in each self-check block
const CKSUM_TARGET = 0x37; //     valid running sum of the first block

export function advanceActorDescentStepAndLand(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + FRAME_HOLD] = FRAME_HOLD_SHORT;
  mem8[rec + ANIM_TICK] = mem8[rec + ANIM_TICK] + 1;
  if ((mem8[rec + ANIM_TICK] & TICK_MASK) === 0) {
    mem8[rec + DISPLAY_TILE] = mem8[rec + DISPLAY_TILE] === TILE_A ? TILE_B : TILE_A;
  }

  const counter = u8(mem8[rec + DESCENT_COUNTER] - DESCENT_STEP);
  mem8[rec + DESCENT_COUNTER] = counter;
  if (counter >= DESCENT_FLOOR) return; // still descending

  if (mem8[loc_8343] !== 0) return tickPhaseTimerAndMaybeRunResetScan(m); // gate set -> countdown/redirect

  mem8[FORMATION_SPAWN_TIMER] = mem8[loc_8343] + SPAWN_TIMER_BASE; // gate byte is 0 -> base
  mem8[rec + FRAME_HOLD] = FRAME_HOLD_LONG;
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1; // advance the record state

  let sum = 0;
  for (let i = 0; i < CKSUM_LEN; i++) sum = u8(sum + mem8[FIELD_ATTRIB_SRC_B + i]);
  if (sum !== CKSUM_TARGET) return advanceRisingActorStep(m, rec); // sum miss -> state-6 handler

  for (let i = 0; i < CKSUM_LEN; i++) {
    if (mem8[FIELD_ATTRIB_REF_2980 + i] !== mem8[FIELD_ATTRIB_SRC_C + i]) return advanceLeadActorDescentToLanding(m, rec);
  }

  enqueueDisplayCommand(m, DESCENT_STATE_COMPLETE_DISPLAY_CMD); // clean check -> enqueue the descent display command
}
