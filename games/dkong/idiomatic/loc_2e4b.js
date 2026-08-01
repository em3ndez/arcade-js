// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2e4b — object update convergence: store the animation-string pointer back into the
 * object record and, at the walk's end boundary, hand the object to its next state.
 * ROM 0x2E4B.
 *
 * One convergence point of the per-object update loop (entry_2e04), reached after the loop
 * has advanced the object one step along its animation string — from obj_2e12's fall-through
 * (a mid-string byte) or from loc_2e9c (the string just wrapped at its terminator). It first
 * stores the current string pointer back into the object record (low at +0x0e, high at
 * +0x0f) so the next pass resumes where this one left off.
 *
 * Then a single end-of-walk test: only when the object has reached the far X limit (0xB7 or
 * beyond) AND the last string byte read was the terminator (0x7F) does the object finish —
 * it is switched to state 4 (handled by loc_2e84) and a transition sound is fired (one
 * sound-trigger latch is cleared, another asserted for three frames). If either condition is
 * unmet the object simply keeps going with no state change.
 *
 * Every path then mirrors the object's position into its paired sprite record and advances
 * both scan cursors, via the shared tail mirrorObjectPositionToSprite.
 *
 * NAME: kept as loc_2e4b. The mechanism is clear (store the string pointer; transition +
 * sound at the position/terminator boundary), but which object and animation this drives, and
 * which sound the latches select, are not grounded here — so the effect-level name is left for
 * a clarify/grounding pass, matching the sibling state handler loc_2e84.
 *
 * The object and sprite cursors, the string pointer (low/high), and the last-read string byte
 * all arrive in registers from the still-translated scan loop (a genuine oracle boundary), so
 * they stay register-carried here.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2e4b.test.js.
 * GATE:     crafted + captured. At a real object/sprite record pair the object X is swept over
 *           all 256 values (crossing the 0xB7 boundary, both branches, terminator held) and the
 *           last-read string byte over all 256 (pinning the 0x7F terminator test, X held past
 *           the boundary); the stored pointer's low and high bytes are each swept over 256 (pins
 *           the two +0x0e/+0x0f stores and rules out a swap or a dropped byte); the exact in-game
 *           cursor sequence is grid-cross-producted; an independence sweep varies the ignored
 *           registers and RAM; and real captured 0x2e4b dispatches from a steered full entry_2e04
 *           loop replay oracle vs candidate. Attract never reaches the loop. The oracle performs
 *           no push/pop, so there is no dead stack churn and no STACK_SCRATCH exclusion.
 * LIVE-OUT: the pointer stores (+0x0e/+0x0f) and, on the transition path, the state byte (+0x0d)
 *           and the two sound-trigger latches, plus the two sprite-position writes the mirror
 *           tail makes; and the registers that tail leaves — object cursor +16, sprite cursor +4,
 *           remaining-object count preserved, step value 4. The scratch byte the oracle leaves in
 *           the accumulator is dead: the loop reloads it for the next object before any test.
 * NAMES:    OBJ_X (+0x03), SND_TRIGGER (0x6080) — from ram.js. The object-record state (+0x0d)
 *           and string-pointer (+0x0e/+0x0f) field offsets have no ram.js name and stay local.
 */

import { OBJ_X, SND_TRIGGER } from "./ram.js";
import { mirrorObjectPositionToSprite } from "./mirrorObjectPositionToSprite.js"; // ROM 0x2E6C

// Object-record field offsets without a ram.js name (indexed off the object-scan cursor).
const OBJ_STATE = 0x0d;   // object state field; obj_2e12 dispatches state 4 to loc_2e84
const OBJ_STR_PTR = 0x0e; // 16-bit animation-string pointer: low at +0x0e, high at +0x0f

const X_BOUNDARY = 0xb7;         // object X at/past which the walk can finish
const STRING_TERMINATOR = 0x7f;  // animation-string end sentinel (the last byte read)
const NEXT_STATE = 4;            // state the finished object is handed to (the loc_2e84 handler)

/**
 * @param {object} m  the machine. The object/sprite cursors, the string pointer, and the
 *                    last-read string byte arrive in registers; writes go through memory.
 * @returns {void}
 */
export function loc_2e4b(m) {
  const { regs, mem } = m;
  const ix = regs.ix;

  // Store the current animation-string pointer back into the object record so the next pass
  // resumes from it.
  mem.write8(ix + OBJ_STR_PTR, regs.l);
  mem.write8(ix + OBJ_STR_PTR + 1, regs.h);

  // Finish the walk only at the far edge with the string wrapped: object at/past the X limit
  // AND the last string byte was the terminator.
  if (mem.read8(ix + OBJ_X) >= X_BOUNDARY && regs.c === STRING_TERMINATOR) {
    // Hand the object to its next state and fire the transition sound (clear one sound-trigger
    // latch, assert another for three frames).
    mem.write8(ix + OBJ_STATE, NEXT_STATE);
    mem.write8(SND_TRIGGER + 3, 0);
    mem.write8(SND_TRIGGER + 4, 3);
  }

  // Draw the object's sprite at the object's position and advance both scan cursors.
  mirrorObjectPositionToSprite(m);
}
