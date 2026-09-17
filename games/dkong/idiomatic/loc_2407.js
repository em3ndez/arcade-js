// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2407 — spread a packed nibble-pair from an object record into a fixed-point value
 * ((highDigit << 8) | (lowDigit << 4)) and subtract the record's 16-bit operand; returns the
 * 16-bit difference, wrapping on borrow.
 *
 * LIVE-OUT: the 16-bit difference, returned and also mirrored into the register pair the callers
 * read as its two halves.
 */

import { u16 } from "../../../core/int.js";

// Record-field offsets addressed off the caller's object pointer.
const PACKED = 0x14;      // two 4-bit digits packed into one byte (highDigit, lowDigit)
const OPERAND_HI = 0x12;  // upper byte of the 16-bit operand to subtract
const OPERAND_LO = 0x13;  // lower byte of the 16-bit operand to subtract

export function loc_2407(m, record = m.regs.ix) {
  const { regs, mem8 } = m;

  const packed = mem8[(record + PACKED) & 0xffff];
  const highDigit = packed >> 4;
  const lowDigit = packed & 0x0f;
  const spread = (highDigit << 8) | (lowDigit << 4);

  const operand = (mem8[(record + OPERAND_HI) & 0xffff] << 8) | mem8[(record + OPERAND_LO) & 0xffff];

  const difference = u16(spread - operand);

  regs.hl = difference;
  return difference;
}
