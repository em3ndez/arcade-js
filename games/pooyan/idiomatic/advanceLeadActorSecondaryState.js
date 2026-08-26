// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { ROUND_COUNTER, PLAY_STATE_INDEX, FORMATION_STATE, ACTOR_TABLE, LEAD_ACTOR_STATE } from "./names.js";
import { runLaunchAndTargetActorPipeline } from "./runLaunchAndTargetActorPipeline.js";
import { loc_2901 } from "./loc_2901.js";
import { loc_29a0 } from "./loc_29a0.js";
import { loc_2a01 } from "./loc_2a01.js";
import { loc_2a32 } from "./loc_2a32.js";
import { loc_2a79 } from "./loc_2a79.js";
import { loc_2a96 } from "./loc_2a96.js";
import { advanceRisingActorStep } from "./advanceRisingActorStep.js";
import { clearActorArenaAndCounters } from "./clearActorArenaAndCounters.js";
/**
 * advanceLeadActorSecondaryState — per-frame driver for the lead actor's secondary state machine.
 *
 * Runs the frontier sub-dispatch, then steers the play sub-state: an even round forces sub-state 6,
 * a busy formation forces 4. Otherwise it ticks the actor's frame delay and, once the delay expires,
 * runs the handler for the actor's state (low three bits), passing the record base (ACTOR_TABLE).
 * The handler returns to this driver's caller; the shared spawn/formation epilogue is a downstream
 * continuation reached elsewhere, not from this routine.
 *
 * LIVE-OUT: none — a void per-frame driver.
 */
const FRAME_DELAY = 0x11; // actor-record frame-delay offset
const STATE_MASK = 0x07; // three-bit secondary-state index

export function advanceLeadActorSecondaryState(m) {
  const { mem8 } = m;
  runLaunchAndTargetActorPipeline(m);
  if ((mem8[ROUND_COUNTER] & 1) === 0) { mem8[PLAY_STATE_INDEX] = 0x06; return; }
  if (mem8[FORMATION_STATE] !== 0) { mem8[PLAY_STATE_INDEX] = 0x04; return; }

  mem8[ACTOR_TABLE + FRAME_DELAY] = u8(mem8[ACTOR_TABLE + FRAME_DELAY] - 1);
  if (mem8[ACTOR_TABLE + FRAME_DELAY] !== 0) return; // delay still running -> nothing more this frame
  switch (mem8[LEAD_ACTOR_STATE] & STATE_MASK) {
    case 0: return loc_2901(m, ACTOR_TABLE);
    case 1: return loc_29a0(m, ACTOR_TABLE);
    case 2: return loc_2a01(m, ACTOR_TABLE);
    case 3: return loc_2a32(m, ACTOR_TABLE);
    case 4: return loc_2a79(m, ACTOR_TABLE);
    case 5: return loc_2a96(m, ACTOR_TABLE);
    case 6: return advanceRisingActorStep(m, ACTOR_TABLE);
    case 7: return clearActorArenaAndCounters(m);
  }
}
