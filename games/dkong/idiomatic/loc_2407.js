// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2407 — spread a packed nibble-pair into a fixed-point value and subtract a 16-bit
 * operand; returns the difference.
 *
 * A pure arithmetic LEAF on one object record, whose base the caller supplies. It reads
 * three record bytes, writes NO memory, calls nothing, and hands back a single 16-bit
 * number.
 *
 * One record byte packs two 4-bit digits — a high digit and a low digit — into a single
 * byte. Those digits are spread apart into a fixed-point layout: the high digit lands in
 * the low nibble of the upper byte, and the low digit lands in the upper nibble of the
 * lower byte, so the value is (highDigit << 8) | (lowDigit << 4). That puts the low digit
 * in a "sixteenths" position, which is what makes the packed byte read as a quantity with
 * a 4-bit fraction. The 16-bit operand carried across the record's other two bytes is then
 * subtracted from it, and the difference — wrapping at 16 bits on a borrow — is the result.
 *
 * NOT CLAIMED: a single game purpose. Each caller uses the difference differently — one
 * stores its two halves back into the record as a landing target, one halves it and stores
 * it, one treats it as a coordinate — so what is pinned is the shared computation, a
 * fixed-point subtract, and nothing above it.
 *
 * Reads: three bytes of the record the caller points at. Writes: nothing.
 *
 * LIVE-OUT: the 16-bit difference. It is returned, and also mirrored into the register pair
 * the callers read as its two halves, because they still take it that way.
 */

import { u16 } from "../../../core/int.js";

// Record-field offsets addressed off the caller's object pointer.
const PACKED = 0x14;      // two 4-bit digits packed into one byte (highDigit, lowDigit)
const OPERAND_HI = 0x12;  // upper byte of the 16-bit operand to subtract
const OPERAND_LO = 0x13;  // lower byte of the 16-bit operand to subtract

/**
 * @param {object} m  the machine (reads m.mem via the caller's object pointer in m.regs.ix).
 * @returns {number}  the 16-bit fixed-point difference (also mirrored into the caller-read
 *                    register pair as its high/low halves).
 */
export function loc_2407(m) {
  const { regs, mem } = m;
  const record = regs.ix;

  // Spread the packed byte's two digits into the fixed-point layout: high digit into the
  // upper byte, low digit into the upper nibble of the lower byte.
  const packed = mem.read8((record + PACKED) & 0xffff);
  const highDigit = packed >> 4;
  const lowDigit = packed & 0x0f;
  const spread = (highDigit << 8) | (lowDigit << 4);

  // The 16-bit operand carried across the record's upper and lower operand bytes.
  const operand = (mem.read8((record + OPERAND_HI) & 0xffff) << 8) | mem.read8((record + OPERAND_LO) & 0xffff);

  // Fixed-point difference; wraps at 16 bits on borrow (the subtract carries no borrow-in).
  const difference = u16(spread - operand);

  // The callers read the result back as the two halves of this register pair, so mirror it
  // there in addition to returning it.
  regs.hl = difference;
  return difference;
}
