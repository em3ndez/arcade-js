// SPDX-License-Identifier: GPL-3.0-only
import { runLaunchAndTargetActorPipeline } from "./runLaunchAndTargetActorPipeline.js";
import { renderMarkerColumnExtendOrRetract } from "./renderMarkerColumnExtendOrRetract.js";
import { dispatchFormationPhaseOrQueueLaunchSlots } from "./dispatchFormationPhaseOrQueueLaunchSlots.js";
import { TAMPER_FREEZE_FLAG, ACTOR_TABLE } from "./names.js";
import { beginLeadActorLiftOnClear } from "./beginLeadActorLiftOnClear.js";
import { dropLeadActorAfterDelay } from "./dropLeadActorAfterDelay.js";
import { nudgeLeadActorAndAdvanceOnDelay } from "./nudgeLeadActorAndAdvanceOnDelay.js";
import { descendLeadActorToLanding } from "./descendLeadActorToLanding.js";
import { advanceActorDropStateOnDelay } from "./advanceActorDropStateOnDelay.js";
import { advancePlayStateToPhase7OnActorDelay } from "./advancePlayStateToPhase7OnActorDelay.js";

/**
 * advanceLeadActorPrimaryState — the per-frame heartbeat of the lead-actor group.
 *
 * WHAT IT IS
 *   ROM 0x241e-0x2435. Once every frame the machine reaches this routine to advance the
 *   "lead actor" — slot 0 of the actor arena, the contiguous 0x18-byte-per-record array based at
 *   ACTOR_TABLE (0x8a80). Slot 0 is the player/lead actor; the enemy, projectile and formation
 *   records follow it in the same block. This driver first ticks three shared per-frame passes
 *   that keep the surrounding object world moving, and then steps the lead actor's own little
 *   state machine one notch.
 *
 * ROLE IN THE MACHINE
 *   It is the top of the lead-actor update chain. The three sub-passes it runs unconditionally
 *   each frame are: (1) the launch/target pipeline that drives the boot/launch sequence and arms
 *   spawn slots, (2) the lift/marker column renderer, and (3) the formation manager. After those,
 *   it consults an anti-tamper freeze latch; if the ROM has been found altered the whole lead-actor
 *   state advance is abandoned for the frame (one of the ways a tampered ROM degrades into a
 *   visibly broken game). When not frozen, it reads the lead actor's state index and hands control
 *   to the one handler responsible for that state.
 *
 *   The state index at ACTOR_TABLE+0x02 (the record's +0x02 "state" field, i.e. LEAD_ACTOR_STATE
 *   0x8a82) walks a fixed cycle 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 0 as the lead actor plays out its
 *   arena-entrance choreography — lift on a cleared field, drop after a delay, nudge, descend to
 *   the landing floor, and so on — each handler pacing its own transition and advancing the index
 *   when its step completes. The six handlers form a jump table; a given frame runs exactly one.
 *
 * ROM ADDRESS: 0x241e-0x2435 (the six-entry jump table lives at 0x2436-0x2441).
 * Grounding: [seen]
 *
 * LIVE-OUT: none — a void per-frame dispatch. Its effect is entirely in the sub-passes and the
 *   one state handler it invokes, which mutate the actor records, sound queue and formation state.
 */
const STATE_MASK = 0x07; // the state field is read three bits wide (matching the ROM's `and 7`)

export function advanceLeadActorPrimaryState(m) {
  const { mem8 } = m;
  // --- Three shared per-frame sub-passes, always run, in this fixed order ---
  // These keep the object world alive independently of the lead actor's own state. Run first so
  // that even a frozen (tampered) frame below still advances launch/marker/formation bookkeeping.
  // (1) Launch & target pipeline (ROM 0x2101): drives the launch-sequence state, performs the
  //     one-shot slot-arming advance, and scans the paired slots for integrity.
  runLaunchAndTargetActorPipeline(m);
  // (2) Marker/lift column renderer (ROM 0x25a6): extends or retracts the on-screen lift/marker
  //     column at the current layout pointer.
  renderMarkerColumnExtendOrRetract(m);
  // (3) Formation manager (ROM 0x308b): while the formation is active it dispatches the current
  //     formation phase; otherwise it scans actor records for launch-ready slots and queues them,
  //     arming the formation once the slot table fills.
  dispatchFormationPhaseOrQueueLaunchSlots(m);
  // --- Anti-tamper gate (ROM 0x242a: ld a,(0x881e) / and a / ret nz) ---
  // TAMPER_FREEZE_FLAG (0x881e) is a strike tally the ROM/signature checksum guards bump when the
  // program image fails to match its expected fold. It is 0 on an intact ROM. A nonzero value
  // halts the lead-actor state machine for this frame: return before the dispatch so slot 0's
  // state never advances, freezing the lead actor in place.
  if (mem8[TAMPER_FREEZE_FLAG] !== 0) return; // frozen -> skip the dispatch
  // --- Dispatch on the lead actor's state (ROM 0x2430: ld a,(ix+2) / and 7 / rst 0x28) ---
  // Read slot 0's state field at ACTOR_TABLE+0x02, mask to three bits, and index the six-entry
  // jump table. Each handler receives the record base (ACTOR_TABLE) as its working record and, when
  // its own step finishes, advances the state index so the next frame lands on the following case.
  // The masked value only ever runs 0..5 in play (the entrance cycle); a handler is a tail step —
  // it returns to this driver's caller rather than back here.
  switch (mem8[ACTOR_TABLE + 0x02] & STATE_MASK) {
    // State 0 (ROM 0x2442): seed and snapshot the record on a cleared field, load the shape table,
    // queue the tile-run sound — the start of the lead actor's lift-in.
    case 0: return beginLeadActorLiftOnClear(m, ACTOR_TABLE);
    // State 1 (ROM 0x2473): count down the record's frame-delay (+0x11); on expiry reseed it,
    // advance the state, nudge the Y field and load the next shape table — the drop step.
    case 1: return dropLeadActorAfterDelay(m, ACTOR_TABLE);
    // State 2 (ROM 0x2497): frame-delay countdown, then advance the state, load the shape table,
    // and nudge the primary record's base-Y (+4) and the secondary (-6).
    case 2: return nudgeLeadActorAndAdvanceOnDelay(m, ACTOR_TABLE);
    // State 3 (ROM 0x24b9): on alternate frames step the Y coordinate down toward the landing floor
    // (0xdc); once the floor is reached, play the sound, reseed the delay and advance the state.
    case 3: return descendLeadActorToLanding(m, ACTOR_TABLE);
    // State 4 (ROM 0x24db): once its delay elapses, step the falling actor's record fields.
    case 4: return advanceActorDropStateOnDelay(m, ACTOR_TABLE);
    // State 5 (ROM 0x24fb): frame-delay countdown, then stamp the shape flag and load the shape
    // table — the last notch before the index wraps back to 0.
    case 5: return advancePlayStateToPhase7OnActorDelay(m, ACTOR_TABLE);
  }
}
