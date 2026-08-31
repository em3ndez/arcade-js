// SPDX-License-Identifier: GPL-3.0-only
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { advanceObjectCountdownAndEmitDisplayCommand } from "./advanceObjectCountdownAndEmitDisplayCommand.js";
import { ARM_ANIM_TABLE } from "./names.js";
/**
 * armObjectAnimationAndSeedCountdown — (re)arm an object record, then fall into its countdown tail.
 *
 * WHAT IT IS
 *   Every animated object in the arena lives in a 0x18-byte record based at IX. Each frame the
 *   record's state byte (rec+0x02, masked to five bits) selects one handler from the object's
 *   state machine; this routine is the handler for STATE 8 — the "re-arm my animation and start
 *   counting down" state. It fits an object with a fresh animation sequence, gives it a fixed
 *   dwell before its next display event, and steps it into the counting-down state.
 *
 * ROLE IN THE MACHINE
 *   An object reaches this state when it has just changed what it is (landed, settled, was
 *   struck, is about to award) and now needs a new look plus a paced delay before the next thing
 *   happens. The record carries an ARM INDEX at rec+0x17 that names which animation the object
 *   should adopt; this routine turns that index into an animation-sequence pointer through the
 *   arm-animation pointer table (ARM_ANIM_TABLE, ROM 0x41B1 — a word table of sequence pointers),
 *   installs it, seats the frame-delay countdown, and advances the record from state 8 to state 9.
 *   State 9 is precisely the shared object countdown handler, so once the state byte is bumped the
 *   routine falls straight into that handler for the rest of this frame — the same code the object
 *   will run on its own on every following frame until the countdown lapses.
 *
 * ROM: 0x417A-0x418C.
 * Grounding: [seen].
 *
 * LIVE-OUT: none — a shared object-state tail; all effect is in the object record's memory (its
 * animation pointer + frame index, its rec+0x11 countdown, its rec+0x02 state index) and whatever
 * the countdown tail leaves behind. No caller reads a register back.
 */
// The three object-record fields this routine touches, as byte offsets from the record base (IX):
const REC_ARM_INDEX = 0x17; // rec+0x17 — the arm index: which entry of ARM_ANIM_TABLE to adopt
const REC_COUNTDOWN = 0x11; // rec+0x11 — the frame-delay countdown that gates the next display event
const REC_STATE = 0x02; //     rec+0x02 — the state index (masked to five bits) that selects the handler
// The dwell seated into rec+0x11: the object holds and animates for 0x30 (48) frames before its
// countdown lapses in state 9 and it emits its display command.
const COUNTDOWN_SEED = 0x30;

export function armObjectAnimationAndSeedCountdown(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — resolve the animation. Read the record's arm index from rec+0x17 and look up its
  // entry in the arm-animation pointer table at ROM 0x41B1. That table holds one 16-bit animation-
  // sequence pointer per entry; the fetched word (left in DE) is the sequence this object will play.
  fetchWordFromTableIndex(m, mem8[rec + REC_ARM_INDEX], ARM_ANIM_TABLE); // DE := table[arm index]

  // Step 2 — install it. Point the record at the sequence just fetched: writes the sequence pointer
  // into the record's animation field (rec+0x0c/0x0d) and forces the frame index (rec+0x0e) to 0 so
  // the new sequence plays from its first frame. This consumes the pointer left in DE by step 1.
  setActorAnimation(m, rec); // point the record at the looked-up sequence (consumes DE)

  // Step 3 — seat the dwell. Load rec+0x11 with 0x30, the number of frames the object holds (while
  // still animating) before the countdown lapses in state 9 and it emits its next display command.
  mem8[rec + REC_COUNTDOWN] = COUNTDOWN_SEED;

  // Step 4 — advance the state machine. Bump the state index at rec+0x02 from 8 to 9. State 9 IS
  // the shared object countdown handler, so from next frame on the dispatcher will route this record
  // straight to it, and the fall-through below runs that same handler for the remainder of this frame.
  mem8[rec + REC_STATE] = mem8[rec + REC_STATE] + 1;

  // Fall into the tail. With the record re-armed and stepped to state 9, hand it to the shared object
  // countdown handler: it advances the animation, ticks the rec+0x11 countdown, and on expiry emits a
  // display command and re-arms the record — the object's behaviour for the rest of this frame.
  return advanceObjectCountdownAndEmitDisplayCommand(m, rec);
}
