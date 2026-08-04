// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBarrelRight — the +X motion arm of the barrel walk: stage the two forward-step values the
 * shared roll tail consumes, advance this barrel's X by one, and run that tail.
 *
 * Three acts and nothing else: bank the register file, load the two constants, increment OBJ_X.
 * The direction in the name is the sign of that increment on the record's own X field.
 *
 * THE REGISTER-BANK SWAP IS A CONTRACT, NOT SCRATCH BOOKKEEPING. Every motion arm does its work
 * in the alternate bank and none of them swaps back; the swap back happens where the arms
 * converge, and it is what puts the walk's own loop state — its sprite-record cursor, its record
 * stride and its remaining count — back in play. Dropping the swap here would let the tail's
 * scratch land on those live loop registers instead. (The record pointer itself is in the index
 * register, which the swap does not touch, which is why the tail can still address the record
 * while working in the alternate bank.)
 *
 * THE TWO STAGED VALUES have separate consumers further down the tail:
 *   • The step selector reaches the girder snap. 1 is the value that makes it snap on the
 *     offset-0 edge of a 16-pixel girder cell, which is the edge a barrel walking X UPWARDS
 *     crosses first; the mirror arm passes a value that snaps on the offset-15 edge instead.
 *   • The second value is folded into the selector for a packed sprite-orientation lookup, so it
 *     steers which sprite bytes the barrel ends up wearing. WHICH FRAME IT SELECTS IS NOT
 *     ESTABLISHED HERE — all that is derived is that this arm passes 0.
 *
 * LIVE-OUT: memory-only — the incremented OBJ_X and the two values staged in the alternate bank —
 * plus the tail's return value propagated unchanged. The one thing dropped is the flag state the
 * increment leaves at the moment the tail is entered.
 */

import { OBJ_X } from "./names.js";

// Staged for the tail, which takes both out of the shadow register set.
const GIRDER_SNAP_STEP = 1; // the girder snap's step selector: snap on the offset-0 edge
const TAIL_SELECT_BITS = 0; // OR-ed into the orientation lookup's selector; steers the sprite bytes

/**
 * @param {object} m       the machine.
 * @param {number} record  base address of the object record being stepped.
 * @returns {*}            the shared tail's return value, propagated unchanged.
 */
export function stepBarrelRight(
  m,
  record = m.regs.ix /* default: the motion dispatch leaves the record base in this register */,
) {
  const { regs, mem8 } = m;

  // Into the shadow set — see the contract above. The tail does not swap back.
  regs.exx();

  regs.b = GIRDER_SNAP_STEP;
  regs.c = TAIL_SELECT_BITS;

  // One pixel forward. The store truncates, so an X of 255 wraps to 0 here exactly as
  // the hardware does.
  mem8[record + OBJ_X] = mem8[record + OBJ_X] + 1;

  // The tail reads the record base out of the index register rather than taking an
  // argument, so publish it there before handing over. A no-op on the default.
  regs.ix = record;

  // The shared roll tail. Entered by a jump, so there is no return address to push beside
  // it: this routine's own return IS the tail's return.
  return m.call(0x1ff6);
}
