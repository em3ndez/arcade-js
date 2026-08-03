// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1fac — carry an object record one step along its travel, and stamp it on arrival.
 * ROM 0x1FAC.
 *
 * One arm of the per-slot dispatch that drives the ten OBJ_ARRAY_67 records while BOARD is 1
 * (the walk starts at ROM 0x1F72 and the arm is chosen at ROM 0x1F93). Every frame a record is
 * on this arm, its OBJ_Y (+5) advances by one. On the single frame the new value equals the
 * target held in +0x17, the record also gets a fresh OBJ_SPRITE_CODE (+7) and the low three bits
 * of its arm-select byte (+2) are flipped; every other frame it falls straight through to the
 * shared step at ROM 0x1FCE. Both exits converge on the shared sprite-record tail at ROM 0x21BA.
 *
 * READ: OBJ_Y (+5), +0x17, +0x15, +2.  WRITTEN: OBJ_Y (+5), OBJ_SPRITE_CODE (+7), +2.
 *
 * WHAT IT DOES IN THE GAME, and what that rests on. Two things were measured over a 3000-frame
 * attract run (446 dispatches), and both could have come out the other way:
 *   - The travel is one-directional and lands exactly on the target. OBJ_Y was strictly below
 *     +0x17 on all 446 entries, and each of the 13 completed travels took exactly
 *     (target - start) dispatches — e.g. record 0x6720 walked 79 -> 112 over 33 frames. So
 *     +0x17 is the value this step stops on, not a threshold it crosses.
 *   - Flipping the low three bits of +2 HANDS THE RECORD TO A DIFFERENT ARM. Those are exactly
 *     the three bits the per-slot dispatch at ROM 0x1F93 tests in order, and bit 0 — the one
 *     that selected THIS arm — is necessarily set on entry, so the flip always clears it. The
 *     prediction: the record's next dispatch must take a different arm. Checked against the run:
 *     +2 went 3 -> 4 eight times and 5 -> 2 five times, and the same record's next per-slot
 *     dispatch went to ROM 0x1FEF eight times and ROM 0x1FE5 five times — the arms bit 2 and
 *     bit 1 select. A record therefore alternates between this travel step and the horizontal
 *     steps rather than staying here.
 *
 * THE SHADOW REGISTER-BANK SWAP IS A CONTRACT ACROSS THE CLUSTER, not a local convenience, and
 * it is why `regs.exx()` survives into idiomatic code. This routine reads nothing out of the
 * swapped bank — it works only in the accumulator and the record pointer — so the swap does
 * nothing FOR IT. What it does is hand the walk's cursors and slot count to the shared sprite
 * tail at ROM 0x21BA, whose own leading swap is the counter-move that restores them for the loop
 * step at ROM 0x1F8D. Both of this routine's exits reach that tail (ROM 0x1FCE tails into it and
 * likewise touches no swapped register), so the pairing holds on both arms. Dropping the swap
 * here would leave the tail swapping the live set away instead of back. It stays until ROM 0x21BA
 * is decompiled, at which point the pair can be dissolved together.
 *
 * NOT CLAIMED. What +0x15 means: attract holds it at 0 on every one of the 446 dispatches, so the
 * only naturally exercised stamp is the constant 21, and the rotate is covered by crafted entries
 * alone. The sibling arm at ROM 0x20A2 reads the same byte as a zero/non-zero gate, so its role
 * beyond "the input to this stamp" is not derived here. Nor is what the target in +0x17 means —
 * ROM 0x216D computes and stores it, and that routine was not read for this file.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1fac.test.js.
 * GATE:     captured, ATTRACT ONLY, plus one crafted sweep. Reachability was MEASURED first:
 *           446 real dispatches in 3000 attract frames, first around frame 728, across six
 *           OBJ_ARRAY_67 record bases (0x6700/20/40/60/80/A0). EVERY one of the 446 is replayed
 *           inline, twice over — once with the frozen tail chain running for real (compared on
 *           the full state dump, pc, SP, the whole register file and the return value), once with
 *           both tails stubbed so the branch this routine takes and the register state it hands
 *           over are directly observable. The arrival arm is only 13 of the 446, and attract holds
 *           +0x15 at 0 on all 446, so 258 crafted entries built ON A REAL ARRIVAL CAPTURE cover
 *           what attract cannot produce: all 256 values of +0x15, and two travel-field wraps.
 *           Credited gameplay, boards 2-4 and two-player are NOT covered. Teeth, four twins, each
 *           observed catching its own defect: a shift in place of the rotate (invisible to all 446
 *           natural dispatches — caught by 192 of the 258 crafted entries, and BOTH halves of that
 *           are asserted), a dropped bank swap (446/446), a dropped arm-select flip (13/446, i.e.
 *           exactly the arrival dispatches), and a dropped travel step (446/446).
 * LIVE-OUT: memory-only, plus the propagated return value (undefined on every observed dispatch —
 *           both arms are tail jumps, so the value is whatever the shared tail chain finally
 *           returns). No register and no flag of this routine's own. Derived: the accumulator and
 *           the flags are the only state the head leaves, and both hand-off targets overwrite them
 *           before reading — ROM 0x1FCE's first act loads +0x0F into the accumulator and re-tests,
 *           ROM 0x21BA's is a bank swap then a load of +3. Measured TWICE, and at the SEAM rather
 *           than after it: poisoning the accumulator and the whole flag byte on the FIRST entry to
 *           either tail leaves the state dump, pc and SP identical on all 446 dispatches; and with
 *           the rewrite wired live for a 3000-frame attract run (588 dispatches) the per-frame
 *           trace is identical, on the FULL dump including the stack scratch, to the same machine
 *           running the oracle at the same address. The record pointer is deliberately NOT a
 *           parameter: both tails are still frozen and read it off the machine, so a caller
 *           passing anything else would be obeyed here and ignored one call later. It becomes an
 *           honest parameter once ROM 0x1FCE and 0x21BA are decompiled.
 * NAMES:    OBJ_Y (+5) and OBJ_SPRITE_CODE (+7) from ram.js. The other three record fields this
 *           routine touches (+0x17, +0x15, +2) have no ram.js name and stay file-local consts
 *           below. The two calls out are ROM 0x1FCE and ROM 0x21BA, both still frozen: they are
 *           in the same mutually-recursive cluster and are being decompiled concurrently.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_Y, OBJ_SPRITE_CODE } from "./ram.js";

// Record-field offsets with no ram.js name, kept in hex to read alongside the ram.js OBJ_*
// offsets they sit next to. Listed for the lead: none of the three is registered, and each is
// scoped to what THIS routine can show, not proposed as a shared object-record field.

/** +0x17 — the OBJ_Y value this travel stops on. Only two sites in the ROM touch it: this read
 *  and the write at ROM 0x216D. */
const TRAVEL_TARGET_Y = 0x17;
/** +0x15 — the record byte the arrival stamp is derived from. Named for this routine's use of
 *  it only; the sibling arm at ROM 0x20A2 reads the same byte as a zero/non-zero gate. */
const ARRIVAL_CODE_SOURCE = 0x15;
/** +2 — the byte the per-slot dispatch at ROM 0x1F93 tests bit by bit to pick an arm (bit 0 ->
 *  here, bit 1 -> ROM 0x1FE5, bit 2 -> ROM 0x1FEF, none -> ROM 0x2053). ram.js deliberately
 *  scopes the neighbouring +1 rather than naming it globally, because these low record bytes
 *  carry unrelated roles in other arrays; the same caution applies here. */
const ARM_SELECT = 0x02;

/** The constant the arrival sprite code is built on top of. */
const ARRIVAL_CODE_BASE = 21;

/**
 * @param {object} m  the machine. The record pointer stays in the machine's index register
 *   rather than becoming a parameter: both hand-off targets are still the frozen oracle and read
 *   the record straight off the machine, so a passed-in value would be honoured by the body below
 *   and then ignored one call later.
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

  // Still travelling: the shared step at ROM 0x1FCE handles the rest of the frame.
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
