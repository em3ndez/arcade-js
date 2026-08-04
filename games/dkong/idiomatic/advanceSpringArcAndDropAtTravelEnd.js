// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSpringArcAndDropAtTravelEnd — the spring's per-object body: carry one spring on along its
 * bounce arc, and drop it off the end of its travel.
 *
 * It is a mid-body convergence point inside the spring routine's own loop, reached once the loop
 * has advanced the spring one step along its animation string — either from the mid-string
 * fall-through or from the arm that has just wrapped the string at its terminator. It first stores
 * the current string pointer back into the record (low at +0x0e, high at +0x0f) so the next pass
 * resumes where this one left off: THAT is what continues the arc.
 *
 * Then a single end-of-travel test, and only when BOTH halves hold: the spring has reached the far
 * X limit AND the last string byte read was the terminator. On that frame it is DROPPED — handed to
 * NEXT_STATE and given a transition sound (one sound-trigger latch cleared, another asserted for
 * three frames). If either half is unmet the spring simply keeps going, with no state change.
 *
 * Every path then mirrors the spring's position into its paired sprite record and advances both
 * scan cursors, through the shared tail.
 *
 * The object and sprite cursors, the string pointer (low and high) and the last-read string byte
 * all arrive in registers from the scan loop, so they stay register-carried here.
 *
 * LIVE-OUT: the pointer stores and, on the drop path, the state byte and the two sound-trigger
 * latches, plus the two sprite-position writes the mirror tail makes; and the registers that tail
 * leaves — object cursor advanced, sprite cursor advanced, remaining count preserved. The scratch
 * byte left in the accumulator is dead: the loop reloads it for the next object before any test.
 */

import { OBJ_X, OBJ_STATE, SND_TRIGGER } from "./names.js";
import { mirrorObjectPositionToSprite } from "./mirrorObjectPositionToSprite.js";

// Animation-string pointer offset, with no registered name (indexed off the object-scan cursor).
const OBJ_STR_PTR = 0x0e; // 16-bit animation-string pointer: low at +0x0e, high at +0x0f

const X_BOUNDARY = 0xb7;         // spring X at/past which the travel can finish
const STRING_TERMINATOR = 0x7f;  // animation-string end sentinel (the last byte read)
const NEXT_STATE = 4;            // the state a dropped spring is handed to

/**
 * @param {object} m  the machine. The object/sprite cursors, the string pointer, and the
 *                    last-read string byte arrive in registers; writes go through memory.
 * @returns {void}
 */
export function advanceSpringArcAndDropAtTravelEnd(m) {
  const { regs, mem } = m;
  const ix = regs.ix;

  // Store the current animation-string pointer back into the record so the next pass resumes
  // from it — the arc continues because this pointer does.
  mem.write8(ix + OBJ_STR_PTR, regs.l);
  mem.write8(ix + OBJ_STR_PTR + 1, regs.h);

  // Drop the spring only at the far edge with the string wrapped: at/past the X limit AND the
  // last string byte was the terminator.
  if (mem.read8(ix + OBJ_X) >= X_BOUNDARY && regs.c === STRING_TERMINATOR) {
    // Hand it to its next state and fire the transition sound (clear one sound-trigger latch,
    // assert another for three frames).
    mem.write8(ix + OBJ_STATE, NEXT_STATE);
    mem.write8(SND_TRIGGER + 3, 0);
    mem.write8(SND_TRIGGER + 4, 3);
  }

  // Draw the spring's sprite at its position and advance both scan cursors.
  mirrorObjectPositionToSprite(m);
}
