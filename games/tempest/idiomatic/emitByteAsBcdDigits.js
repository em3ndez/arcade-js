// SPDX-License-Identifier: GPL-3.0-only
import { packBinaryToBcd } from "./packBinaryToBcd.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";

/**
 * emitByteAsBcdDigits — render a binary byte as its two decimal digits. ROM 0xaf77.
 *
 * Role in the machine: on-screen counters (the tube's depth-row labels, scores, and other small
 * numbers) are drawn as vector digits. This takes a plain binary value and turns it into two decimal
 * glyphs by first converting to packed BCD, so a value like 63 prints as "6" "3" rather than as a hex
 * or raw byte. drawTubeWell uses it to label each depth row.
 *
 * Behavior: packBinaryToBcd converts A to packed BCD and stashes it in the scratch cell (loc_29); then
 * emitNibbleDigitRun walks that one byte at 0x29 for 0x01 iterations, emitting its high and low nibbles
 * as two vector digits.
 *
 * Live-out: two digit records appended to the draw stream; the BCD scratch byte at 0x29. Grounding: [seen].
 */
export function emitByteAsBcdDigits(m, a = m.regs.a) {
  packBinaryToBcd(m, a);                 // binary A -> packed BCD in scratch cell 0x29
  emitNibbleDigitRun(m, 0x29, 0x01);     // emit that one byte's two nibbles as decimal glyphs
}
