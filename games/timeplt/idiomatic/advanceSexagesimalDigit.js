// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSexagesimalDigit — advance one two-digit packed-decimal place of a base-sixty counter.
 *
 * ROM 0x4D67-0x4D71 (loc_4d67). Grounding: [seen] (names.js ROUTINES 0x4D67).
 *
 * What it is: one byte holds one "place" of the counter as two decimal digits packed into its two
 * nibbles (packed BCD: 0x59 means fifty-nine). This steps that place on by one and rolls it over
 * to zero once it reaches sixty, so a place runs 00..59 like the seconds or minutes of a clock.
 *
 * Role in the machine: its one caller, escalateDifficultyRungOnCounterWrap, chains it over three
 * neighbouring cells (LIFE_TICKS_LOW and the two above it) and stops at the first place that does
 * not wrap — so whether the place wrapped, not the byte, is the product. The counter it serves is
 * NOT a clock: under MAME one wrap took 84, 95, 120 and 140 frames on four tapes, because the
 * caller runs once per dispatch of the round engine's service block and that block does not run
 * every frame. A MAME write tap on the stepped cell saw only 00-09 .. 50-59 and 60, and the
 * wrap store fired exactly as often as 60 was written.
 *
 * Parameter: `cell` — the address of the place to step (HL in the ROM).
 *
 * LIVE-OUT: the byte at `cell`; and whether it rolled over, returned as true/false. (The ROM
 * reports the same fact in the carry flag, inverted: carry set means it did NOT wrap.)
 */

import { u8 } from "../../../core/int.js";

// A place wraps once its packed-decimal value reaches 0x60 = "60".
const ROLLS_OVER_AT = 0x60;
// The low (units) digit of a packed-decimal byte.
const LOW_DIGIT = 0x0f;
// The largest valid packed-decimal byte, "99".
const HIGHEST = 0x99;
// The decimal adjust adds 6 to push a units digit past 9 into the tens nibble...
const DIGIT_CARRY = 6;
// ...and 0x60 to push a tens digit past 9 out of the byte.
const TENS_CARRY = 0x60;

/**
 * Add one, then apply the decimal adjust exactly as the Z80's `daa` does after an `add a,0x01`.
 * The adjust is reproduced from the hardware's own rule (half-carry out of the units nibble, or a
 * units digit above 9, adds 6; a carry out of the byte, or a result above 0x99, adds 0x60) rather
 * than a tidier "decimal increment", so a byte that was never valid packed decimal still comes out
 * exactly where the hardware would put it.
 */
function stepPackedDecimal(value) {
  // The binary add: `add a,0x01`, eight bits wide.
  const sum = u8(value + 1);
  let correction = 0;
  // A units nibble of 0xF before the add is exactly when the add carried out of the low nibble
  // (the half-carry); either that or a units digit now above 9 needs the +6 digit carry.
  if ((value & LOW_DIGIT) === LOW_DIGIT || (sum & LOW_DIGIT) > 9) correction += DIGIT_CARRY;
  // 255 is the only value whose +1 carries out of the byte; that or a result above "99" needs the
  // +0x60 tens carry.
  if (value === 255 || sum > HIGHEST) correction += TENS_CARRY;
  return u8(sum + correction);
}

export function advanceSexagesimalDigit(m, cell = m.regs.hl) {
  const { mem8 } = m;
  // Step the place and write it back straight away (`ld a,(hl) / add a,0x01 / daa / ld (hl),a`).
  // The store comes BEFORE the wrap test, so a place that lands on sixty or beyond is written
  // twice in one call: once stepped, once as zero.
  const stepped = stepPackedDecimal(mem8[cell]);
  mem8[cell] = stepped;

  // The wrap test, `cp 0x60`: below sixty the ROM returns at once (`ret c`); at or above it the
  // place is reset with `ld (hl),0x00` and the caller is told it wrapped, so it steps the next place.
  const rolledOver = stepped >= ROLLS_OVER_AT;
  if (rolledOver) mem8[cell] = 0;
  return rolledOver;
}
