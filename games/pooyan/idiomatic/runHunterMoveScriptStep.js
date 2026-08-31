// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_SEQ_2D5D } from "./names.js";

// ---------------------------------------------------------------------------
// Actor-record field offsets touched by this handler.
//
// A hunter lives in one 0x18-byte record inside the actor pool, and the same
// offsets carry the same meaning in every sweep that visits the record. This
// state reuses six of those fields: the state index, a signed-delta latch, a
// 16-bit move-script cursor, the 16-bit position, and the frame-hold counter.
// ---------------------------------------------------------------------------
const SIGN_FLAG = 0x15; //   signed-delta latch: bit0 chooses add (+) vs subtract (-) for each position delta
const SCRIPT_LO = 0x16; //   move-script cursor, low byte (16-bit pointer into the ROM movement-script byte stream)
const SCRIPT_HI = 0x17; //   move-script cursor, high byte
const STATE_FIELD = 0x02; // record state index (masked by the per-record sweep to pick a handler); bumped on the 0x88 opcode
const POS_LO = 0x03; //      16-bit horizontal position, low byte
const POS_HI = 0x04; //      16-bit horizontal position, high byte
const HOLD_FIELD = 0x11; //  frame-hold: how many frames the freshly-armed animation frame stays on screen; reseeded on the 0x88 opcode
const OP_RELOAD = 0xff; //   script byte: latch the add direction into the sign flag, keep scanning
const OP_ANIMATE = 0x88; //  script byte: bump the record state + arm the turn animation

/**
 * runHunterMoveScriptStep -- hunter attacker, movement state (record state 1).
 *
 * WHAT IT IS. Pooyan's launch pipeline seeds a run of "hunter" attackers that ride into the
 * play area and follow a scripted flight path. Each hunter is one record in the 0x18-byte
 * actor pool, and every frame the hunter sweep dispatches the record on its state index
 * (rec+0x02) into a small per-record state machine. This is the state-1 handler: the movement
 * state, in which the hunter steps its animation and then executes one command from its
 * move script.
 *
 * ROM 0x2cb3. Grounding: [seen].
 *
 * THE MOVE SCRIPT. The record carries a 16-bit cursor (rec+0x16 low, rec+0x17 high) into a
 * ROM byte stream of movement commands, and a persistent sign latch (rec+0x15). One command
 * is consumed per frame:
 *   - 0xff  -- reload the direction: force the sign latch to 0xff (bit0 set = add). Consecutive
 *             0xff bytes are all skipped in one pass, arming the direction just before the delta
 *             that follows.
 *   - 0x88  -- turn/animate: advance the record state so the sweep routes it to its next state
 *             next frame, arm the turn animation (ANIM_SEQ_2D5D), and reseed the frame-hold.
 *   - other -- a position-delta magnitude: added to (bit0 set) or subtracted from (bit0 clear)
 *             the record's 16-bit position (rec+0x03 low / rec+0x04 high), carrying/borrowing
 *             into the high byte.
 *
 * LIVE-OUT: returns true (the "normal" completion the per-frame hunter sweep expects). All
 * other effects land in the record's memory -- state (rec+0x02), animation + frame-hold
 * (rec+0x11), sign latch (rec+0x15), script cursor (rec+0x16:0x17), and position
 * (rec+0x03:0x04). No register is read back.
 */
export function runHunterMoveScriptStep(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step the hunter's on-screen animation one frame first, independent of the move script:
  // every frame in this state advances the record's tile/attribute animation stream.
  advanceObjectAnimationFrame(m, rec); // step the animation sequence first

  // Fetch the record's 16-bit move-script cursor (little-endian across rec+0x16/0x17) and read
  // the command byte it currently points at.
  let cursor = mem8[rec + SCRIPT_LO] | (mem8[rec + SCRIPT_HI] << 8);
  let op = mem8[cursor];

  // Reload run: every leading 0xff forces the sign latch to the add direction (0xff -> bit0 set)
  // and is skipped without ending the step, so a run of 0xff arms the direction for the delta
  // that comes after it. The loop leaves the cursor on the first non-0xff command byte.
  while (op === OP_RELOAD) {
    mem8[rec + SIGN_FLAG] = op; // latch 0xff (sets bit0)
    cursor = u16(cursor + 1);
    op = mem8[cursor];
  }

  // Turn/animate opcode: this frame does not move the hunter. Bump the record state so the sweep
  // hands the record to its next state next frame, arm the turn animation sequence, and reseed
  // the frame-hold so the new animation frame holds for 0x20 frames. The cursor is deliberately
  // left pointing at the 0x88 byte -- this state will not run on the record again.
  if (op === OP_ANIMATE) {
    mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;
    setActorAnimation(m, rec, ANIM_SEQ_2D5D);
    mem8[rec + HOLD_FIELD] = 0x20;
    return true;
  }

  // Ordinary command: a position-delta magnitude. Step the cursor past the delta byte and store
  // it back into the record so the next frame reads the following command.
  cursor = u16(cursor + 1); // step past the delta byte, then store the cursor back
  mem8[rec + SCRIPT_LO] = cursor;
  mem8[rec + SCRIPT_HI] = cursor >> 8;

  // Apply the delta to the 16-bit position (rec+0x03 low / rec+0x04 high). The sign latch bit0
  // picks the direction; the position bytes are 8-bit stores, so the high byte carries/borrows.
  if (mem8[rec + SIGN_FLAG] & 0x01) {
    // Add: magnitude onto the low byte, propagating a carry up into the high byte.
    const sum = mem8[rec + POS_LO] + op;
    mem8[rec + POS_LO] = sum;
    if (sum > 0xff) mem8[rec + POS_HI] = mem8[rec + POS_HI] + 1; // carry into the high byte
  } else {
    // Subtract: magnitude off the low byte, borrowing down from the high byte on underflow.
    const diff = mem8[rec + POS_LO] - op;
    mem8[rec + POS_LO] = diff;
    if (diff < 0) mem8[rec + POS_HI] = mem8[rec + POS_HI] - 1; // borrow from the high byte
  }
  return true;
}
