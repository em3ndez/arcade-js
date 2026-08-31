// SPDX-License-Identifier: GPL-3.0-only
import {
  SPRITE_OBJECT_TABLE,
  FRAME_COUNTER,
  ACTOR_TAMPER_CKSUM_TOP,
  SIGNATURE_MISMATCH_FLAG,
} from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { u16 } from "../../../core/int.js";
/**
 * advanceActorStateOnTimerWithTamperCheck
 * =======================================
 *
 * WHAT IT IS
 *   One handler in the actor state machine. Every animated thing on screen -- the player,
 *   enemies, projectiles, spawned objects -- is a fixed-layout "actor record" in work RAM,
 *   and each record carries a state index. Once per frame the game walks the records and, for
 *   each, jumps through the actor-state jump table to the handler its state selects. This is
 *   the handler for actors that advance on a per-record countdown timer, and it also carries a
 *   piggy-backed ROM integrity (anti-tamper) check, run at most once per frame.
 *
 * ROLE IN THE MACHINE (what one call does, in order):
 *   1. Plays this actor's animation for the frame.
 *   2. Decrements the actor's per-record countdown timer. While it is still running the actor
 *      is just holding its current state, so the handler returns and does nothing else.
 *   3. On timer expiry it advances the actor's sub-state one step and clears a status bit.
 *   4. Band gate: only records that live at or above the spawned-object table
 *      (SPRITE_OBJECT_TABLE, 0x8b70) go further; records lower in RAM (the player / lead-actor
 *      records) return here.
 *   5. For an in-band record it also decrements two more record fields.
 *   6. Frame gate: the anti-tamper check runs only on the frame where the free-running
 *      FRAME_COUNTER (0x8a5f) reads 0.
 *   7. It then folds a fixed ROM block into a wrapping checksum. A genuine ROM folds to the
 *      expected value and nothing happens; a patched ROM folds to something else and trips
 *      the signature-mismatch flag.
 *
 * ROM ADDRESS: 0x3865-0x38a4.
 * GROUNDING: [seen].
 *
 * LIVE-OUT (all it leaves behind is in memory; it returns nothing to its caller):
 *   - The actor record based at IX: RECORD_TIMER decremented every call; on expiry
 *     RECORD_SUBSTATE +1 and RECORD_STATUS bit0 cleared, and (in-band only) RECORD_FIELD_A and
 *     RECORD_FIELD_B decremented.
 *   - SIGNATURE_MISMATCH_FLAG (0x8ef0): incremented when the ROM checksum does not fold clean.
 */

// Actor-record field offsets -- byte positions inside the record based at IX:
const RECORD_TIMER = 0x11; // per-actor countdown; the actor advances when it reaches 0
const RECORD_SUBSTATE = 0x02; // the actor's sub-state, bumped one step on timer expiry
const RECORD_STATUS = 0x08; // status/flags byte; bit0 is cleared on expiry
const RECORD_FIELD_A = 0x04; // in-band auxiliary field, decremented each expiry
const RECORD_FIELD_B = 0x06; // in-band auxiliary field, decremented each expiry
// Anti-tamper checksum parameters:
const CKSUM_TERMINATOR = 0x1a; // byte value marking the bottom of the summed ROM block
const RESULT_MASK = 0x9e; // bits the folded (carries+sum) result must be clear in to pass

export function advanceActorStateOnTimerWithTamperCheck(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // STEP 1 -- Animate this actor for the frame. advanceObjectAnimationFrame (ROM 0x4006) steps
  // the actor's animation-script cursor and stamps its current tile/colour. This runs every
  // frame the actor is in this state, before and independent of the timer logic below.
  advanceObjectAnimationFrame(m, ix); // run the animation player for this record

  // STEP 2 -- Tick the actor's countdown. RECORD_TIMER (ix+0x11) is decremented with 8-bit
  // wrap. While it is still non-zero the actor is holding its current phase, so the handler
  // returns and leaves the rest of the actor's state untouched this frame.
  const timer = (mem8[ix + RECORD_TIMER] - 1) & 0xff;
  mem8[ix + RECORD_TIMER] = timer;
  if (timer !== 0) return; // timer still running

  // STEP 3 -- Timer expired, so advance the actor. Bump RECORD_SUBSTATE (ix+0x02) to move the
  // actor to its next phase, and clear bit0 of the status byte RECORD_STATUS (ix+0x08).
  mem8[ix + RECORD_SUBSTATE] = mem8[ix + RECORD_SUBSTATE] + 1;
  mem8[ix + RECORD_STATUS] = mem8[ix + RECORD_STATUS] & ~0x01;

  // STEP 4 -- Band gate. Everything below applies only to actor records that live at or above
  // the spawned-object table (SPRITE_OBJECT_TABLE, 0x8b70). The record pointer (IX) is checked
  // one byte at a time -- high byte first, then low byte -- against that base; a record below
  // the band returns here and skips the field decrements and the checksum entirely.
  // Per-byte reach test (high byte then low byte) against the object-table band base.
  if (((ix >> 8) & 0xff) < ((SPRITE_OBJECT_TABLE >> 8) & 0xff)) return;
  if ((ix & 0xff) < (SPRITE_OBJECT_TABLE & 0xff)) return;

  // STEP 5 -- In-band field maintenance. For records in the band, run down two more fields
  // alongside the main timer: RECORD_FIELD_A (ix+0x04) and RECORD_FIELD_B (ix+0x06).
  mem8[ix + RECORD_FIELD_A] = mem8[ix + RECORD_FIELD_A] - 1;
  mem8[ix + RECORD_FIELD_B] = mem8[ix + RECORD_FIELD_B] - 1;

  // STEP 6 -- Frame gate for the integrity check. FRAME_COUNTER (0x8a5f) is a free-running
  // counter decremented every vblank; the anti-tamper work below runs only on the single frame
  // where it reads 0, so the check costs at most one pass per counter cycle. Otherwise return.
  if (mem8[FRAME_COUNTER] !== 0) return; // frame gate not open

  // STEP 7 -- Fold a fixed ROM block into a wrapping checksum. Starting at ACTOR_TAMPER_CKSUM_TOP
  // (ROM 0x4282) and walking downward, add each byte into an 8-bit running sum (`sum`) while
  // tallying every time an add overflows 8 bits (`carries`). The walk stops as soon as the next
  // byte down equals CKSUM_TERMINATOR (0x1a), which marks the bottom of the checked block (that
  // terminator byte is the stop sentinel and is not itself summed).
  let sum = 0;
  let carries = 0;
  let ptr = ACTOR_TAMPER_CKSUM_TOP;
  for (;;) {
    const total = sum + mem8[ptr];
    ptr = u16(ptr - 1);
    sum = total & 0xff;
    if (total > 0xff) carries = (carries + 1) & 0xff;
    if (mem8[ptr] === CKSUM_TERMINATOR) break;
  }

  // STEP 8 -- Verdict. Add the carry tally to the running sum and mask with RESULT_MASK (0x9e).
  // A genuine ROM block folds so those bits come out clear -- the handler returns, nothing amiss.
  // If any masked bit survives, the block did not fold to its expected value, so the handler
  // increments SIGNATURE_MISMATCH_FLAG (0x8ef0), the work-RAM ROM-signature mismatch flag.
  if (((carries + sum) & RESULT_MASK) === 0) return; // clean
  mem8[SIGNATURE_MISMATCH_FLAG] = mem8[SIGNATURE_MISMATCH_FLAG] + 1;
}
