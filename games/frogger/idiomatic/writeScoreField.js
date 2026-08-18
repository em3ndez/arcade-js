// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeScoreField  —  ROM 0x0b95  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   Frogger's score / point-value field printer — the entry rung of the on-screen readout ladder. Given a
 *   16-bit packed-BCD word and a tilemap write pointer, it draws a FIVE-cell numeric readout: the word's
 *   four decimal digits, most-significant first, followed by one fixed literal "0".
 *
 *   That trailing zero is the game's score-STORAGE convention, not a decoration. Scores are held as
 *   value/10 in a BCD word and the ones place is ALWAYS drawn as 0, so a stored word of 0x0463 shows on
 *   screen as "04630". One consequence worth keeping in mind: a stored BCD delta of 1 is worth 10
 *   displayed points, and a delta of 0x20 is worth 200.
 *
 * WHERE IT SITS
 *   The top of the digit-printing family — it owns no memory cell and does no stamping itself; every rung
 *   below it does the real work:
 *       [this] (0x0b95) → writePackedBcdWord (0x0b9b) → writePackedBcdByte (0x0ba0) → writeScoreDigitStepUp (0x0ba9)
 *   writePackedBcdWord lays down the four significant digits (the high byte's two, then the low byte's),
 *   and the single-numeral atom writeScoreDigitStepUp appends the trailing "0". Callers reach the screen
 *   through here to print the P1 / high / P2 scores, the extra-life score target, the attract score-ranking
 *   table, and the per-board point targets.
 *
 * HOW THE POINTER MOVES
 *   Each numeral steps the write pointer UP one 32-cell tilemap row — on this rotated, Galaxian-derived
 *   display one visible character cell is 32 memory cells away, so a horizontal run of digits on screen is
 *   a run of cells 32 apart in memory. The four-digit call threads its stepped pointer straight into the
 *   trailing-zero stamp, so the field is laid out contiguously with no pointer reload between them.
 *
 * LIVE-OUT
 *   Memory only — the five tilemap cells it stamps. The trailing-zero atom does hand back the pointer
 *   stepped one further row (and writes it to HL), and we return that, but the field is complete at that
 *   point and no caller reads the position back — so this routine is treated as memory-only.
 */
import { writePackedBcdWord } from "./writePackedBcdWord.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

// The fixed ones-place digit every score field ends with. Because scores are stored as value/10 in packed
// BCD, the on-screen ones column is always a literal "0" (0x0463 → "04630"). Passing 0 as the digit makes
// writeScoreDigitStepUp stamp tile 0 — the char-ROM glyph "0" — into that final cell.
const TRAILING_ZERO_DIGIT = 0;

// value / ptr default to the Z80 registers the ROM routine reads (DE = the packed-BCD score word, HL = the
// tilemap write pointer), matching the hardware calling convention while still allowing an explicit call.
export function writeScoreField(m, value = m.regs.de, ptr = m.regs.hl) {
  // ── The four significant digits ─────────────────────────────────────────────────────────
  // Print the packed-BCD word as its four decimal digits, most-significant first, starting at ptr — these
  // become the four leading digits of the readout. writePackedBcdWord returns the write pointer stepped
  // four rows up (the position of the fifth and final cell), which we thread into the trailing-zero stamp.
  const ptrAfterFourDigits = writePackedBcdWord(m, value, ptr);

  // ── The trailing literal "0" ────────────────────────────────────────────────────────────
  // Stamp the fixed ones-place zero into that fifth cell, completing the five-cell readout. Its return
  // (the pointer stepped one more row) is passed straight out as this routine's result, though callers
  // treat the field as memory-only and do not read it back.
  return writeScoreDigitStepUp(m, TRAILING_ZERO_DIGIT, ptrAfterFourDigits);
}
