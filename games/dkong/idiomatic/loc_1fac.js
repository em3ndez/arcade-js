// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1fac — carry an object record one step along its travel, and stamp it on arrival.
 *
 * One arm of the per-slot dispatch that drives the ten OBJ_ARRAY_67 records on the girder board.
 * Every frame a record is on this arm, its OBJ_Y advances by one. On the single frame the new
 * value equals the target the record carries, it also gets a fresh OBJ_SPRITE_CODE and the low
 * three bits of its arm-select byte are flipped; every other frame it falls straight through to
 * the shared travel step. Both exits converge on the sweep's shared sprite-record tail.
 *
 * READ: OBJ_Y, the travel target, the arrival-code source, the arm-select byte.
 * WRITTEN: OBJ_Y, OBJ_SPRITE_CODE, the arm-select byte.
 *
 * WHAT IT DOES IN THE GAME. Two things, both watched on a live playfield rather than reasoned
 * about:
 *   - The travel is ONE-DIRECTIONAL and lands exactly ON the target. OBJ_Y is strictly below the
 *     target on entry, and a travel takes exactly (target - start) dispatches to complete. So the
 *     target is the value this step stops on, not a threshold it crosses.
 *   - Flipping the low three bits of the arm-select byte HANDS THE RECORD TO A DIFFERENT ARM.
 *     Those are exactly the three bits the per-slot dispatch tests in order, and the bit that
 *     selected THIS arm is necessarily set on entry, so the flip always clears it. Watched across
 *     a run, the record's next dispatch does go to one of the horizontal-step arms — a record
 *     alternates between this travel step and those rather than staying here.
 *
 * THE SHADOW REGISTER-BANK SWAP IS A CONTRACT ACROSS THE SWEEP, not a local convenience, and it is
 * why the swap survives into idiomatic code. This routine reads nothing out of the swapped bank —
 * it works only in the accumulator and the record pointer — so the swap does nothing FOR IT. What
 * it does is hand the walk's cursors and slot count to the shared sprite tail, whose own leading
 * swap is the counter-move that restores them for the next loop step. Both of this routine's exits
 * reach that tail, so the pairing holds on both arms. Dropping the swap here would leave the tail
 * swapping the live set away instead of back.
 *
 * NOT CLAIMED. What the arrival-code source byte MEANS: in ordinary play it sits at 0, so the only
 * behaviour seen is the constant stamp, and the rotate is exercised by construction only. Nor is it
 * derived here what the travel target means — a different routine computes and stores it, and that
 * routine was not read for this file.
 *
 * LIVE-OUT: memory-only, plus the propagated return value (undefined on every dispatch observed —
 * both arms are tail jumps, so the value is whatever the shared tail chain finally returns). No
 * register and no flag of this routine's own: the accumulator and the flags are the only state the
 * head leaves, and both hand-off targets overwrite them before reading. The record pointer is
 * deliberately NOT a parameter — both tails read it off the machine, so a caller passing anything
 * else would be obeyed here and ignored one call later.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_Y, OBJ_SPRITE_CODE } from "./names.js";

// Three record fields with no shared name, kept as file-local offsets. Each is scoped to what
// THIS routine can show, not proposed as a shared object-record field.

/** The OBJ_Y value this travel stops on. Only two sites touch it: this read, and one write. */
const TRAVEL_TARGET_Y = 0x17;
/** The record byte the arrival stamp is derived from. Named for this routine's use of it only;
 *  a sibling arm reads the same byte as a zero/non-zero gate. */
const ARRIVAL_CODE_SOURCE = 0x15;
/** The byte the per-slot dispatch tests bit by bit to pick an arm — bit 0 selects this one, the
 *  other two select the horizontal steps, and none set falls through to the arc-travel branch.
 *  These low record bytes carry unrelated roles in other arrays, so the offset is not given a
 *  shared name. */
const ARM_SELECT = 0x02;

/** The constant the arrival sprite code is built on top of. */
const ARRIVAL_CODE_BASE = 21;

/**
 * @param {object} m  the machine. The record pointer stays in the machine's index register rather
 *   than becoming a parameter: both hand-off targets read the record straight off the machine, so
 *   a passed-in value would be honoured by the body below and then ignored one call later.
 * @returns {*} whatever the shared tail chain returns (undefined on every dispatch observed).
 */
export function loc_1fac(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;

  // Hand the walk's cursors and slot count to the shared sprite tail, whose own swap is the
  // counter-move. Nothing below reads a swapped register. See the header.
  regs.exx();

  // One step of travel.
  const y = u8(mem8[record + OBJ_Y] + 1);
  mem8[record + OBJ_Y] = y;

  // Still travelling: the shared travel step handles the rest of the frame.
  if (mem8[record + TRAVEL_TARGET_Y] !== y) return m.call(0x1fce);

  // Arrived. Restamp the sprite from the record's own source byte — rotated left by two, so the
  // top bits wrap round into the bottom rather than falling off — and the byte store truncates
  // the carry out of the base.
  const source = mem8[record + ARRIVAL_CODE_SOURCE];
  mem8[record + OBJ_SPRITE_CODE] = u8((source << 2) | (source >> 6)) + ARRIVAL_CODE_BASE;

  // Flip the three arm-select bits, which clears the one that chose this arm and so sends the
  // record somewhere else next frame.
  mem8[record + ARM_SELECT] = mem8[record + ARM_SELECT] ^ 0x07;

  return m.call(0x21ba);
}
