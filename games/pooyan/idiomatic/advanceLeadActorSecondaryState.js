// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { ROUND_COUNTER, PLAY_STATE_INDEX, FORMATION_STATE, ACTOR_TABLE, LEAD_ACTOR_STATE } from "./names.js";
import { runLaunchAndTargetActorPipeline } from "./runLaunchAndTargetActorPipeline.js";
import { advanceLeadActorDescentToLanding } from "./advanceLeadActorDescentToLanding.js";
import { advanceActorDescentStepAndLand } from "./advanceActorDescentStepAndLand.js";
import { advanceActorState2AndCapWaveArrival } from "./advanceActorState2AndCapWaveArrival.js";
import { advanceActorPositionAndEnqueueMilestone } from "./advanceActorPositionAndEnqueueMilestone.js";
import { verifySignatureThenClearFlipAndAdvance } from "./verifySignatureThenClearFlipAndAdvance.js";
import { verifySignatureThenSetFlipAndAdvance } from "./verifySignatureThenSetFlipAndAdvance.js";
import { advanceRisingActorStep } from "./advanceRisingActorStep.js";
import { clearActorArenaAndCounters } from "./clearActorArenaAndCounters.js";
/**
 * advanceLeadActorSecondaryState — per-frame driver for the lead actor's secondary state machine.
 *
 * WHAT IT IS
 *   The lead actor is slot 0 of the actor arena — the record based at ACTOR_TABLE (0x8a80),
 *   the player/lead actor. Beyond its primary movement state (the low bits of LEAD_ACTOR_STATE,
 *   which drive a 6-way movement dispatch elsewhere), the lead actor owns a SECONDARY state
 *   machine that this routine steps once per frame. Each of its eight secondary states has its
 *   own handler, and the per-record frame-delay countdown (record byte +0x11) paces how often
 *   the machine is allowed to take a step.
 *
 * ROLE IN THE MACHINE
 *   Invoked once per frame as one of the six sub-drivers the alternate gameplay-frame
 *   coordinator (stepGameplayFrame) runs — the formation manager, the lift/marker column
 *   driver, the enemy and formation object sweeps, THIS lead-actor secondary machine, and the
 *   sprite-display-list rebuild. It first drains the boot-frontier sub-dispatch
 *   (runLaunchAndTargetActorPipeline), then either short-circuits the play sub-state
 *   (PLAY_STATE_INDEX) or paces and dispatches the lead actor's own secondary handler.
 *
 * FLOW (each frame, in order):
 *   1. Run the launch/target frontier passes (runLaunchAndTargetActorPipeline).
 *   2. EVEN round (ROUND_COUNTER 0x8907 bit0 clear): the secondary machine does not run this
 *      frame — force the play sub-state PLAY_STATE_INDEX (0x880a) to 6 (the after-teardown
 *      state) and return.
 *   3. Otherwise, while an enemy-formation launch is busy (FORMATION_STATE 0x8f08 nonzero):
 *      yield — force PLAY_STATE_INDEX to 4 and return.
 *   4. Otherwise tick the lead actor's frame-delay countdown (record +0x11); while it is still
 *      nonzero the machine holds and there is nothing more to do this frame.
 *   5. On delay expiry, dispatch on the lead actor's secondary state (LEAD_ACTOR_STATE 0x8a82,
 *      low three bits) into one of eight handlers, handing each the arena base ACTOR_TABLE.
 *
 *   The dispatched handler returns to this driver's caller; the shared spawn/formation
 *   epilogue is a downstream continuation reached elsewhere, not from this routine.
 *
 * ROM 0x28c6-0x28f0.
 * Grounding: [seen].
 * LIVE-OUT: PLAY_STATE_INDEX (0x880a) may be forced to 6 or 4; the lead actor's frame-delay
 *   byte (ACTOR_TABLE +0x11 = 0x8a91) is decremented; on expiry the chosen handler mutates the
 *   actor record / arena. The routine returns no value — a void per-frame driver.
 */
const FRAME_DELAY = 0x11; // actor-record offset +0x11: the frame-delay countdown the lead-actor handlers use to pace their transitions
const STATE_MASK = 0x07; // low three bits of LEAD_ACTOR_STATE select the secondary-state handler (0..7)

export function advanceLeadActorSecondaryState(m) {
  const { mem8 } = m;

  // Step 1 — the boot-frontier sub-dispatch. Runs its three frontier sub-passes in order once
  // per call: the launch-sequence state driver, the one-shot slot-arming advance, and the
  // paired-slot integrity scan. (ROM 0x28c6; frontier body at ROM 0x2101.)
  runLaunchAndTargetActorPipeline(m);

  // Step 2 — even-round short-circuit. ROUND_COUNTER (0x8907) bit0 selects the stage-type /
  // facing variant; on an EVEN round (bit0 clear) the lead actor's secondary machine is not
  // stepped — the play sub-state PLAY_STATE_INDEX (0x880a) is forced to 6 (the after-teardown
  // state) and we return. (ROM 0x28c9 ld a,(0x8907) / bit 0,a / ld (0x880a),0x06.)
  if ((mem8[ROUND_COUNTER] & 1) === 0) { mem8[PLAY_STATE_INDEX] = 0x06; return; }

  // Step 3 — formation-busy short-circuit. FORMATION_STATE (0x8f08) is the enemy-formation
  // launch state: 0 while gathering launch-ready slots, nonzero once the formation is full and
  // being dispatched. While a launch is in progress the secondary machine yields — force
  // PLAY_STATE_INDEX (0x880a) to 4 and return. (ROM 0x28d6 ld a,(0x8f08) / and a / ld (0x880a),0x04.)
  if (mem8[FORMATION_STATE] !== 0) { mem8[PLAY_STATE_INDEX] = 0x04; return; }

  // Step 4 — pace the machine. The lead actor is slot 0 of the arena (ACTOR_TABLE 0x8a80); its
  // record byte +0x11 (0x8a91) is the frame-delay countdown the secondary handlers use to space
  // their transitions. Decrement it as a byte (wrapping 0x00 -> 0xff); while it is still nonzero
  // the machine holds and there is nothing more to do this frame. (ROM 0x28e7 dec (ix+0x11) / 0x28ea ret nz.)
  mem8[ACTOR_TABLE + FRAME_DELAY] = u8(mem8[ACTOR_TABLE + FRAME_DELAY] - 1);
  if (mem8[ACTOR_TABLE + FRAME_DELAY] !== 0) return; // delay still running -> nothing more this frame

  // Step 5 — dispatch the secondary state. On delay expiry, read the lead actor's state byte
  // LEAD_ACTOR_STATE (0x8a82 = record +0x02), mask it to its low three bits, and run the matching
  // handler with the arena base ACTOR_TABLE as its record pointer. (ROM 0x28eb ld a,(ix+0x02) /
  // and 0x07 / rst 0x28, inline jump table at 0x28f1.)
  switch (mem8[LEAD_ACTOR_STATE] & STATE_MASK) {
    // State 0 — lead-actor descent-to-landing step (ROM 0x2901).
    case 0: return advanceLeadActorDescentToLanding(m, ACTOR_TABLE);
    // State 1 — descent-step-and-land handler for the record (ROM 0x29a0).
    case 1: return advanceActorDescentStepAndLand(m, ACTOR_TABLE);
    // State 2 — reseat/flip/paint/advance the record, integrity-check the field attribute table,
    // then cap the wave-arrival counter (WAVE_ARRIVAL_COUNTER 0x8903) at 8 (ROM 0x2a01).
    case 2: return advanceActorState2AndCapWaveArrival(m, ACTOR_TABLE);
    // State 3 — tile-flip + 16-bit position advance by 0x80, milestone display-command enqueues,
    // then advance the record's state (ROM 0x2a32).
    case 3: return advanceActorPositionAndEnqueueMilestone(m, ACTOR_TABLE);
    // State 4 — signature check; on a full match clear the record's flip bit and advance its
    // state (ROM 0x2a79).
    case 4: return verifySignatureThenClearFlipAndAdvance(m, ACTOR_TABLE);
    // State 5 — signature check; on a full match reseat the frame-hold, SET the flip bit and
    // advance the record's state (ROM 0x2a96).
    case 5: return verifySignatureThenSetFlipAndAdvance(m, ACTOR_TABLE);
    // State 6 — step a rising actor one motion increment (ROM 0x2ab3).
    case 6: return advanceRisingActorStep(m, ACTOR_TABLE);
    // State 7 — zero the actor arena and reset the spawn/wave counters, forcing the play
    // sub-state to 6 (ROM 0x2ae8). This teardown handler takes no per-record base.
    case 7: return clearActorArenaAndCounters(m);
  }
}
