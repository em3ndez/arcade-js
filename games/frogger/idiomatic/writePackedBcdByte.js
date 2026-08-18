// SPDX-License-Identifier: GPL-3.0-only
/**
 * writePackedBcdByte  —  ROM 0x0ba0  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The two-digit rung of Frogger's readout ladder. A packed-BCD byte carries two decimal digits — the
 *   tens in its high nibble, the ones in its low nibble. This routine prints that byte as two on-screen
 *   numerals, HIGH nibble first then LOW, by handing each nibble in turn to the single-digit atom
 *   writeScoreDigitStepUp (0x0ba9). Everything on screen that is more than one digit wide is built on this
 *   rung: it is where "one byte of packed BCD" becomes "two glyphs stamped into the tilemap".
 *
 * WHERE IT SITS
 *   The middle of the digit-printing family — one level up from the atom, one level below the word/field
 *   printers:
 *       writeScoreField (0x0b95)  →  writePackedBcdWord (0x0b9b)  →  [this]  →  writeScoreDigitStepUp (0x0ba9)
 *   writePackedBcdWord calls this twice (high byte then low) to print a 16-bit value as four digits, and
 *   the end-of-board bonus arm armScoreBonusStrip (0x08c5) calls it directly to print the countdown byte
 *   as two digits. It owns no memory cell of its own and imports no names.js const — it is pure sequencing
 *   over the atom, which does all the real work (the tilemap write and the pointer step).
 *
 * WHY HIGH NIBBLE FIRST
 *   The atom steps the write pointer UP one tilemap row after each stamp (one character cell along this
 *   rotated, Galaxian-derived display). Emitting the tens digit before the ones therefore lays the two
 *   numerals out in reading order and leaves the pointer already two cells on, positioned for the next
 *   byte with no reload — which is exactly what writePackedBcdWord relies on to chain byte after byte.
 *
 * LIVE-OUT
 *   Memory (the two tilemap cells the atom stamps) AND HL — the write pointer advanced two rows past this
 *   byte. The atom both publishes the stepped pointer to m.regs.hl (the Z80 HL register) and returns it;
 *   we thread that return from the first digit into the second, and return the second's, so the caller
 *   reads the final position straight from HL without recomputing it.
 */
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

// A packed-BCD byte stores two decimal digits in its two nibbles. Shifting right by one nibble's width
// brings the HIGH nibble (the tens digit) down into the low four bits, where the atom masks it (& 0x0f)
// and — because the char ROM's tiles 0..9 are the glyphs 0..9 — stamps it directly as its numeral.
const NIBBLE_BITS = 4;

// packed / ptr default to the Z80 registers the ROM routine reads (A = the packed byte, HL = the tilemap
// write pointer), matching the hardware calling convention while still allowing an explicit-argument call.
export function writePackedBcdByte(m, packed = m.regs.a, ptr = m.regs.hl) {
  // ── High digit (tens) ────────────────────────────────────────────────────────────────
  // Bring the high nibble down and stamp it at ptr. writeScoreDigitStepUp writes the glyph and hands back
  // the pointer stepped up one 32-cell row; capture that as the write position for the low digit.
  const ptrAfterHighDigit = writeScoreDigitStepUp(m, packed >> NIBBLE_BITS, ptr);

  // ── Low digit (ones) ─────────────────────────────────────────────────────────────────
  // Stamp the low nibble at the stepped-up pointer. We pass the whole byte, not (packed & 0x0f): the atom
  // already masks to the low nibble, so masking here would be redundant. Its return — the pointer now two
  // rows past where this byte began — is our live-out HL for the caller's next byte.
  return writeScoreDigitStepUp(m, packed, ptrAfterHighDigit);
}
