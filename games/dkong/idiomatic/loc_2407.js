// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2407 — spread a packed nibble-pair into a fixed-point value, then subtract a
 * 16-bit operand; returns the difference.  ROM 0x2407.
 *
 * A pure arithmetic LEAF on one object record (the caller supplies its base). It reads
 * three record bytes, writes NO memory, calls nothing, and hands back a single 16-bit
 * number the caller consumes.
 *
 * The record byte at +0x14 packs two 4-bit digits into one byte: a high digit and a low
 * digit. Those digits are spread apart into a fixed-point layout — the high digit lands
 * in the upper byte (its low nibble) and the low digit lands in the upper nibble of the
 * lower byte, i.e. value = (highDigit << 8) | (lowDigit << 4). That places the low digit
 * in a "sixteenths" position, so the packed byte reads as a fixed-point quantity with a
 * 4-bit fraction. The 16-bit operand held across record bytes +0x12 (upper) and +0x13
 * (lower) is then subtracted from it, and the 16-bit difference (wrapping on borrow) is
 * the result.
 *
 * Each caller uses the difference differently — one stores its two halves back into the
 * record as a landing target, one halves it and stores it, one treats it as a coordinate
 * — which is why this keeps a neutral name: the shared computation is a fixed-point
 * subtract, but no single game-purpose is pinned across the three uses.
 *
 * The record base is the object pointer the caller sets up. All three callers are still
 * the frozen oracle and hand it over the same way (and read the difference back the same
 * way), so this reads the pointer from the machine and mirrors the result into the same
 * register pair the oracle leaves it in; both dissolve to honest params/returns once the
 * callers are decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2407.test.js.
 * GATE:     exhaustive — the result is a total function of the three input bytes
 *           (packed +0x14, operand +0x12/+0x13), swept against the frozen oracle over the
 *           complete 16,777,216-value input space, so this is a proof, not a sample; plus
 *           real captured 0x2407 dispatches from an attract run and their purity check.
 *           Teeth: a swapped-nibble spread, a dropped low-digit shift, and a dropped
 *           16-bit borrow-wrap twin, each caught by the sweep.
 * LIVE-OUT: the 16-bit difference (returned, and mirrored into the register pair the
 *           still-oracle callers read as two halves — one stores both halves, one halves
 *           and stores, one uses it as a coordinate). Writes NO memory; every other
 *           register and flag the oracle leaves behind is dead — no caller reads it before
 *           overwriting it — and the Z80 return is just this function returning, so pc/SP
 *           are not modelled or compared.
 * NAMES:    none — the three operands are object-record field offsets (+0x12/+0x13/+0x14),
 *           i.e. structure displacements off the caller's pointer, not absolute cells, so
 *           they stay local offset consts (the record itself is unnamed in ram.js).
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

  // The 16-bit operand carried across the record's +0x12 (upper) / +0x13 (lower) bytes.
  const operand = (mem.read8((record + OPERAND_HI) & 0xffff) << 8) | mem.read8((record + OPERAND_LO) & 0xffff);

  // Fixed-point difference; wraps at 16 bits on borrow (the subtract carries no borrow-in).
  const difference = u16(spread - operand);

  // BOUNDARY: the three callers are still the frozen oracle and read the result back as
  // the two halves of this register pair, so mirror it there in addition to returning it.
  regs.hl = difference;
  return difference;
}
