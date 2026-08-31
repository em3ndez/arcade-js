// SPDX-License-Identifier: GPL-3.0-only

// The five per-frame sub-passes this gate runs, plus the lead-actor driver it can
// tail into instead. Each is the once-per-frame driver for one class of on-screen
// object; this routine's only job is to pick between the driver and the chain and,
// when the chain wins, run all five in a fixed order.
import { movePlayerVerticallyAndTickStatusRender } from "./movePlayerVerticallyAndTickStatusRender.js";
import { runLaunchAndTargetActorPipeline } from "./runLaunchAndTargetActorPipeline.js";
import { blitTwoTileAnimFrameOnHoldTimer } from "./blitTwoTileAnimFrameOnHoldTimer.js";
import { renderMarkerColumnExtendOrRetract } from "./renderMarkerColumnExtendOrRetract.js";
import { dispatchFormationPhaseOrQueueLaunchSlots } from "./dispatchFormationPhaseOrQueueLaunchSlots.js";
import { advanceLeadActorPrimaryState } from "./advanceLeadActorPrimaryState.js";
import {
  PLAY_MODE_LATCH,
  GRAB_ACTIVE_FLAG,
  HISCORE_TABLE_CORRUPT_FLAG,
  TAMPER_STRIKES_TERMINATOR,
  ACTOR_TABLE,
} from "./names.js";

/**
 * dispatchPerFrameActorUpdatePasses — the per-frame object-update gate.
 *
 * WHAT IT IS
 *   The single decision point that, once per frame during active play, chooses how the
 *   frame's on-screen objects get advanced. It either hands the whole frame to one driver
 *   (the lead-actor driver) or runs the normal chain of five per-frame sub-passes that
 *   advance every class of object — the player, the launch/target actors, the animated
 *   tile pair, the lift/marker column, and the enemy formation.
 *
 * ROLE IN THE MACHINE
 *   This is step 4 of the active-play per-frame worker chain: after the HUD refresh, the
 *   lead-actor input seed, and the sub-state advance, this gate runs; the enemy-spawn pass
 *   and the per-object state sweep follow it. So it sits at the point in the frame where the
 *   moving-object world is stepped forward, just before new objects are spawned in.
 *
 * ROM ADDRESS
 *   0x20d4-0x2100.
 *
 * Grounding: [seen]
 *
 * WHAT DECIDES THE PATH (all cells on the 0x8800 work-RAM page)
 *   - PLAY_MODE_LATCH (0x8f50): the play-state latch. 0 = ordinary in-play; nonzero = an
 *     alternate mode a gameplay handler / post-countdown step has latched (1 or 2).
 *   - GRAB_ACTIVE_FLAG (0x8d32): the rope-grab-in-progress latch, nonzero while a grab runs.
 *   - HISCORE_TABLE_CORRUPT_FLAG (0x8df8) & TAMPER_STRIKES_TERMINATOR (0x8df9): an anti-tamper
 *     pair — a bad high-score-table header/checksum sets the first, the terminator match-scan
 *     integrity guard bumps the second. Their bitwise AND is nonzero only when both have
 *     tripped, the machine's cue that it is running on tampered code.
 *
 * LIVE-OUT
 *   None to the caller — a void driver. Its effect is entirely in the work-RAM and video-RAM
 *   the sub-passes (or the lead-actor driver) mutate as they step the object world.
 */

export function dispatchPerFrameActorUpdatePasses(m) {
  const { mem8 } = m;

  // GATE: decide whether the frame is handled by the lead-actor driver or by the five-pass
  // chain below. The branch is keyed on PLAY_MODE_LATCH (0x8f50) — the two play modes take
  // the object world down two different roads.
  if (mem8[PLAY_MODE_LATCH] === 0) {
    // Ordinary in-play. If a rope-grab is under way (GRAB_ACTIVE_FLAG 0x8d32 set), the lead
    // actor is being carried by that grab, so the whole frame belongs to the lead-actor
    // driver and the normal per-class passes are skipped this frame.
    if (mem8[GRAB_ACTIVE_FLAG] !== 0) return advanceLeadActorPrimaryState(m); // idle + grab set -> lead-actor driver
  } else {
    // An alternate play mode is latched. Cancel any rope-grab first — the mode switch ends
    // it — by clearing GRAB_ACTIVE_FLAG (0x8d32).
    mem8[GRAB_ACTIVE_FLAG] = 0; // busy -> clear the grab flag
    // Anti-tamper diversion: if BOTH the high-score-table corruption flag (0x8df8) and the
    // terminator strike counter (0x8df9) have overlapping set bits, the integrity checks have
    // tripped — hand the frame to the lead-actor driver (the degraded path) instead of the
    // normal chain. On clean code the AND is 0 and control falls through to the chain.
    if ((mem8[HISCORE_TABLE_CORRUPT_FLAG] & mem8[TAMPER_STRIKES_TERMINATOR]) !== 0) return advanceLeadActorPrimaryState(m);
  }

  // NORMAL PATH: run the five per-frame object passes in a fixed order over the actor arena.
  // IX is seated at ACTOR_TABLE (0x8a80), the base of the 0x18-stride actor record array whose
  // slot 0 is the player/lead actor; the passes below walk out from there.

  // Pass 1 — step the player/lead actor's vertical position from the joystick and tick its
  // status render, driving the actor record based at ACTOR_TABLE (0x8a80).
  movePlayerVerticallyAndTickStatusRender(m, ACTOR_TABLE);
  // Pass 2 — the launch/target pipeline: the arrow/rope launch-sequence state driver, the
  // one-shot slot-arming advance, and the paired-slot proximity/integrity scan, in that order.
  runLaunchAndTargetActorPipeline(m);
  // Pass 3 — the frame-gated two-tile animation: a hold-countdown timer that, on expiry, blits
  // two 2x2 tile squares whose source is chosen by round/phase parity.
  blitTwoTileAnimFrameOnHoldTimer(m);
  // Pass 4 — the lift/marker column: extend or retract the marker column at the layout pointer,
  // painting one segment's worth of tiles this frame.
  renderMarkerColumnExtendOrRetract(m);
  // Pass 5 — the enemy-formation manager: dispatch the active formation's phase, or (while no
  // formation is active) scan the actor records for launch-ready slots and queue them.
  dispatchFormationPhaseOrQueueLaunchSlots(m);
}
