// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2053 — the arc-travel branch of the OBJ_ARRAY_67 object sweep: carry one record a frame
 * further along its ballistic arc, then route on what that step ran it into.
 *
 * The body is four decisions in a row:
 *   • Advance the record one frame along its arc — position and airborne-frame counter.
 *   • Probe the girder under it. On contact, control leaves for the girder sub-state machine and
 *     nothing below runs.
 *   • Otherwise retire the record if its X has come within 8 of zero — see below.
 *   • Otherwise run the bounds gate, refresh the sprite orientation, and hand off to the sweep's
 *     shared sprite tail.
 * THE ORDER IS LOAD-BEARING: the girder probe reads the position the arc step has ALREADY written,
 * and the retire test reads it after that again.
 *
 * RETIRING THE RECORD. The test is one window on OBJ_X — 248..255 or 0..7 — so it catches the
 * coordinate walking down to zero and the coordinate wrapping past it with one comparison. The arm
 * it selects zeroes the record's OBJ_ACTIVE and its OBJ_X, and the sweep skips every record whose
 * OBJ_ACTIVE is not 1 — so that arm takes the record out of the sweep rather than merely moving
 * it. WHY the object is finished at that X, as opposed to at some other edge, is NOT established
 * here.
 *
 * THE ORIENTATION SELECTOR is 0 or 4, taken from the low bit of the record's horizontal-velocity
 * high byte, and the orientation refresh folds it into the key of a packed lookup. What each of
 * the two values selects is not established here.
 *
 * THE REGISTER-SET SWAP IS A CONTRACT. This branch swaps to the shadow set on entry and reaches
 * the shared sprite tail WITHOUT swapping back; the swap at the head of that tail is the one that
 * puts the sweep's own loop state — its sprite cursor, record stride and remaining count — back.
 * Dropping the swap here would let this branch's work land on those live loop registers instead.
 *
 * NAME: kept the neutral loc_ — the routing is pinned, but what these records are and what an
 * arc-travelling one represents on screen is not established, so no English name is earned.
 *
 * LIVE-OUT: memory-only, plus WHICH ARM control leaves through. Every arm returns undefined, so
 * the arm itself is the observable. What this branch does NOT hand on is the shadow register set —
 * B', C', D', E', H', L': the two callees it invokes directly define memory plus the contact flag
 * (and the stepped vertical position) as their contract and leave the rest. Nothing downstream
 * reads those six back: no branch of the sweep carries one over from the previous branch, and this
 * branch and its neighbour both open with the arc step, which writes four of the six, while the
 * girder probe writes the other two before reading them. That is also why the final increment of
 * the pair handed over is not performed here — nothing reads the result.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_X } from "./names.js";
import { stepBallisticMotion } from "./stepBallisticMotion.js";
import { loc_2a2f } from "./loc_2a2f.js";
import { advanceBarrelSpriteOrientation } from "./advanceBarrelSpriteOrientation.js";

/**
 * The high byte of the horizontal velocity added into OBJ_X every frame. The registry names no
 * object-record field at this offset; its low bit is all this routine reads, and only to pick the
 * sprite-orientation selector.
 */
const OBJ_VELOCITY_X_HI = 0x10;

/** How close to zero OBJ_X may come before the record is retired: the window is 248..255, 0..7. */
const RETIRE_MARGIN = 8;

/**
 * @param {object} m       the machine.
 * @param {number} record  base address of the object record being carried. Published to the
 *                         machine below, so the tails obey it too.
 * @returns {undefined}    on every arm; control flow, not a value, is what this hands on.
 */
export function loc_2053(
  m,
  record = m.regs.ix /* the caller still hands the record over in the index register */,
) {
  const { regs, mem8 } = m;

  // Into the shadow set — see the contract above. Nothing below swaps back; the shared tail does.
  regs.exx();

  // Everything downstream takes the record out of the index register rather than as an argument,
  // so publish it once here. A no-op on the default, and the one line that makes the parameter
  // above honest.
  regs.ix = record;

  // One frame further along the arc: the record's position and its airborne-frame counter.
  stepBallisticMotion(m);

  // Did that land it on a sloped girder? If so this branch is done — the girder sub-state machine
  // takes over and runs to the shared tail itself.
  if (loc_2a2f(m)) return m.call(0x2083);

  // Travelled to the edge: take the record out of the sweep by clearing its active flag.
  if (u8(mem8[record + OBJ_X] + RETIRE_MARGIN) < 2 * RETIRE_MARGIN) return m.call(0x2079);

  // The bounds gate. On its main path it splices PAST this routine — control never comes back
  // here — so its answer gates everything below. It is entered by a call, so it keeps the
  // return-address bracket the hardware sequence puts in front of it.
  m.push16(0x206b);
  if (!m.call(0x24b4)) return;

  // Refresh the sprite orientation. That refresh still takes its selector off the machine, so
  // stage it there: 0 or 4, from the low bit of the horizontal velocity's high byte.
  regs.c = (mem8[record + OBJ_VELOCITY_X_HI] & 1) * 4;
  advanceBarrelSpriteOrientation(m);

  // The sweep's shared sprite tail, entered by a jump — no bracket, and its return is this
  // routine's return.
  return m.call(0x21ba);
}
