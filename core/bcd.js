// SPDX-License-Identifier: GPL-3.0-only
/**
 * Packed-BCD (binary-coded-decimal) byte arithmetic — the decimal add/subtract the Z80 performs with
 * `add`/`sub`/`dec` followed by `daa`. Used across the idiomatic layer for scores, credits and
 * countdowns. This reproduces core/cpu/z80.js's daa() exactly (which magnitude-corrects in BOTH
 * directions, not the textbook flags-only form), so a routine that used the register `daa` stays
 * byte-for-byte equivalent. Each helper returns { value, carry } where `carry` is the decimal carry-out
 * (add) or borrow-out (subtract) to thread into the next byte. A plain BCD decrement (dec8 then daa with
 * carry clear) is bcdSubByte(v, 1). Verified against the CPU across all inputs by scratchpad/verify_bcd.mjs.
 */
function daaByte(res, halfCarry, carryIn, subtract) {
  let correction = 0;
  let carry = carryIn ? 1 : 0;
  if (halfCarry || (res & 0x0f) > 9) correction |= 0x06;
  if (carry || res > 0x99) {
    correction |= 0x60;
    carry = 1;
  }
  const value = (subtract ? res - correction : res + correction) & 0xff;
  return { value, carry };
}

export function bcdAddByte(a, b, carryIn = 0) {
  const r = a + b + carryIn;
  const res = r & 0xff;
  return daaByte(res, ((a ^ b ^ res) & 0x10) !== 0, r > 0xff, false);
}

export function bcdSubByte(a, b, borrowIn = 0) {
  const r = a - b - borrowIn;
  const res = r & 0xff;
  return daaByte(res, ((a ^ b ^ res) & 0x10) !== 0, r < 0, true);
}
