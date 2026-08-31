// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceObjectColumnByStepAndDispatch } from "./advanceObjectColumnByStepAndDispatch.js";
import { advanceActorColumnAndArmTurnOrBand } from "./advanceActorColumnAndArmTurnOrBand.js";
import { armInteriorBandOrMarkActorActive } from "./armInteriorBandOrMarkActorActive.js";
import { ANIM_ARMED_LATCH } from "./names.js";
/**
 * dispatchActorState1MovementByMode — the state-1 handler for one enemy-actor record.
 *
 * WHAT IT IS
 *   Every moving thing on the playfield (the player, the rope-riding enemies, projectiles, the
 *   fountain and formation objects) lives as a fixed 0x18-byte record in the actor arena based at
 *   ACTOR_TABLE (0x8a80); the enemy records begin at ENEMY_ACTOR_TABLE (0x8ae0). Each frame the
 *   per-record dispatcher reads a record's masked state index (rec+0x02) and routes it to one of the
 *   seventeen state handlers; this routine is the handler for state 1, invoked with the record's base
 *   address in the IX pointer. State 1 is a movement-and-arming state: it keeps the actor's animation
 *   ticking and then, depending on which sub-mode the record is in, either drives the actor's
 *   column/sub-position forward or waits on a shared arming latch before enrolling the actor into its
 *   interior band.
 *
 * ROLE IN THE MACHINE
 *   A prologue that steps the animation and then forks the record down one of three movement paths.
 *   The fork is chosen first by bit 0 of the mode byte (rec+0x01), and then — on the clear arm — by
 *   whether the state byte (rec+0x08) is set. It leaves the actual movement/arming work to the three
 *   handlers it tails into and adds nothing of its own beyond the animation step and the one mode-byte
 *   clear on the latched path.
 *
 *   ROM address: 0x3423 (occupies 0x3423-0x343d).
 *   Grounding: [seen]
 *
 * LIVE-OUT: none — memory only; the record-dispatch caller reloads A and reads no register back.
 */
const OFF_MODE = 0x01; //  mode byte at rec+0x01; bit0 selects which of the two dispatch arms runs
const OFF_STATE = 0x08; // state byte at rec+0x08: nonzero -> Y-movement handler, zero -> X-movement body

export function dispatchActorState1MovementByMode(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // STEP 1 — keep the actor animating.
  // Regardless of which movement path is taken below, state 1 first advances this record's animation.
  // advanceObjectAnimationFrame (0x4006) hangs on the record's frame-hold countdown at rec+0x0e: while
  // that is nonzero it just decrements and holds the current cel, and only on zero does it walk the
  // record's animation-stream pointer (rec+0x0c/0x0d) to the next frame and refill the hold. So the
  // sprite keeps cycling on screen every frame the actor is in state 1.
  advanceObjectAnimationFrame(m, rec); // step the record's animation frame

  // STEP 2 — fork on bit 0 of the mode byte (rec+0x01).
  // Bit 0 clear selects the "moving" arm: the actor is actively traversing its column, and the state
  // byte (rec+0x08) picks which movement handler carries it.
  if ((mem8[u16(rec + OFF_MODE)] & 0x01) === 0) {
    // rec+0x08 nonzero -> advanceObjectColumnByStepAndDispatch (0x34f2): advance the record's 16-bit
    // sub-position (rec+0x05) by its signed step with borrow into the column (rec+0x06), compare the
    // masked column against the turn-column limit, and tail on into the shared movement continuation.
    if (mem8[u16(rec + OFF_STATE)] !== 0) return advanceObjectColumnByStepAndDispatch(m, rec);
    // rec+0x08 zero -> advanceActorColumnAndArmTurnOrBand (0x343e): the X-movement body — advance the
    // sub-position/column and, once it reaches the turn-column limit, arm the turn-around or build and
    // arm the actor's interior sprite band.
    return advanceActorColumnAndArmTurnOrBand(m, rec); // delegate the state-1 X-movement body
  }

  // STEP 3 — bit 0 set selects the "arming" arm, which gates on the shared animation-armed latch.
  // ANIM_ARMED_LATCH (0x8f63) is a machine-wide flag: while it is nonzero the arming path is held off
  // and the actor idles this frame, so newly-armed animations do not race ahead before the latch is
  // released elsewhere in the frame.
  if (mem8[ANIM_ARMED_LATCH] !== 0) return; // latch still armed -> idle

  // STEP 4 — latch clear: consume the mode and hand off to the interior arm.
  // Clearing bit 0 (in fact the whole mode byte at rec+0x01) drops this record out of the arming arm
  // so it will not re-run this gate on the next state-1 frame.
  mem8[u16(rec + OFF_MODE)] = 0x00;
  // armInteriorBandOrMarkActorActive (0x3473) steps the capped animation phase, seeds the turn-column
  // limit and the 2x2 interior sprite band, and falls into the shared movement tail — this is the
  // point at which the actor becomes an active, drawn presence inside the playfield.
  return armInteriorBandOrMarkActorActive(m, rec);
}
