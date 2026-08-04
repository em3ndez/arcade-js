// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSpring — advance ONE 75m spring by one frame: cross it two pixels, add the next delta
 * from its height string so it bounces, and hand the shared tails whatever they need to finish.
 * Called once per slot by the ten-slot sweep, with the spring's record and its paired sprite
 * record already addressed.
 *
 * FOUR ARMS, chosen in this order:
 *   • The slot is INACTIVE (OBJ_ACTIVE bit 0 clear) — nothing to advance, so control goes to the
 *     spawn arm, which is what puts a new spring in the slot.
 *   • Otherwise, once every sixteen frames, the low three bits of the paired sprite's tile code
 *     are flipped. That is a flicker on the drawn sprite only; the dispatch below still runs.
 *   • OBJ_STATE 4 — the retire arm: the step-and-deactivate handler takes it from here.
 *   • Anything else is ordinary travel, and it is inline here.
 *
 * THE TRAVEL ARM IS THE BOUNCE. OBJ_X advances by a FIXED two pixels, so the horizontal crossing
 * is constant and carries no shape at all; everything the eye reads as a bounce comes from the
 * vertical side, where the next byte of a delta string is ACCUMULATED into OBJ_Y (added, not
 * stored). A walk pointer held in the record picks that byte. The terminator sends control to
 * the rewind handler, which is what makes the bounce a repeating cycle rather than a single
 * arc; any other byte advances the pointer past it and converges at the shared tail with the
 * pointer and the byte itself handed over.
 *
 * WHAT THE NAME RESTS ON, from this body alone: constant horizontal speed plus a table-driven
 * vertical delta that rewinds at its terminator is a repeating hop across the screen, and this
 * routine is the whole per-object body of it. A name claiming the motion were computed (a
 * velocity, a fall) would be refuted by the fixed +2 and by the height coming from a string.
 *
 * NOT CLAIMED: what the delta string's bytes are, beyond that they are added to OBJ_Y one per
 * frame; and where the string lives, since only the record's own pointer is read here.
 *
 * Reads FRAME and, from the record, OBJ_ACTIVE, OBJ_STATE, OBJ_X, OBJ_Y and the walk pointer;
 * reads the paired sprite's SPRITE_CODE. Writes OBJ_X, OBJ_Y and SPRITE_CODE; the walk pointer's
 * advance and everything else is written inside the tails.
 *
 * LIVE-OUT: memory, plus the two registers the tails read out of the register file — the last
 * string byte, and (on the ordinary-byte path) the advanced walk pointer.
 */

import { FRAME, OBJ_ACTIVE, OBJ_STATE, OBJ_X, OBJ_Y, SPRITE_CODE } from "./names.js";
import { spawnObjectIntoInactiveSlot } from "./spawnObjectIntoInactiveSlot.js";
import { loc_2e84 } from "./loc_2e84.js";
import { loc_2e9c } from "./loc_2e9c.js";
import { advanceSpringArcAndDropAtTravelEnd } from "./advanceSpringArcAndDropAtTravelEnd.js";

/** Height-string walk pointer inside the record (low byte, then high). No shared name. */
const OBJ_STR_PTR = 0x0e;

const FRAME_TOGGLE_MASK = 0x0f;    // the flicker fires once every 16 frames (FRAME low nibble == 0)
const ANIM_TOGGLE_BITS = 0x07;     // low 3 bits of the sprite tile code flipped by the flicker
const CROSS_STEP = 2;              // pixels of horizontal travel per frame — fixed, never scaled
const RETIRE_STATE = 4;            // the OBJ_STATE the step-and-deactivate handler owns
const STRING_TERMINATOR = 0x7f;    // end of the height string: rewind and bounce again

/**
 * @param {object} m  the machine. The spring's record and its paired sprite record arrive in
 *                    registers; the string byte and advanced pointer leave the same way.
 * @returns {void}
 */
export function advanceSpring(m) {
  const { regs, mem } = m;
  const record = regs.ix;        // the spring's own record
  const spriteRecord = regs.iy;  // the sprite record drawn for it

  // Nothing in this slot: the spawn arm is what fills it.
  if ((mem.read8(record + OBJ_ACTIVE) & 0x01) === 0) {
    spawnObjectIntoInactiveSlot(m);
    return;
  }

  // Every sixteenth frame, flicker the drawn tile. Purely cosmetic; the dispatch below still runs.
  if ((mem.read8(FRAME) & FRAME_TOGGLE_MASK) === 0) {
    mem.write8(spriteRecord + SPRITE_CODE, mem.read8(spriteRecord + SPRITE_CODE) ^ ANIM_TOGGLE_BITS);
  }

  // The retire state steps and deactivates elsewhere.
  if (mem.read8(record + OBJ_STATE) === RETIRE_STATE) {
    loc_2e84(m);
    return;
  }

  // Ordinary travel: cross a fixed two pixels.
  mem.write8(record + OBJ_X, mem.read8(record + OBJ_X) + CROSS_STEP);

  // The bounce comes from the height string, one byte per frame, read through the record's own
  // walk pointer. The tails take the byte out of the register file, so hand it over.
  const ptr = mem.read8(record + OBJ_STR_PTR) | (mem.read8(record + OBJ_STR_PTR + 1) << 8);
  const delta = mem.read8(ptr);
  regs.c = delta;

  // End of the string: rewind, which is what makes the bounce repeat.
  if (delta === STRING_TERMINATOR) {
    loc_2e9c(m);
    return;
  }

  // Otherwise step past the byte and ACCUMULATE it into the height, then converge at the shared
  // tail (it stores the advanced pointer and runs the end-of-travel boundary test).
  regs.hl = (ptr + 1) & 0xffff;
  mem.write8(record + OBJ_Y, delta + mem.read8(record + OBJ_Y));
  advanceSpringArcAndDropAtTravelEnd(m);
}
