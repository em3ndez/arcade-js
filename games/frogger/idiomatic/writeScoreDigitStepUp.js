// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeScoreDigitStepUp  —  ROM 0x0ba9  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The single-numeral atom of Frogger's entire on-screen readout. Given one BCD digit and a tilemap
 *   write pointer, it stamps that digit's glyph into one tilemap cell, then walks the pointer up one
 *   display cell so the next digit lands in the adjacent position. Every number the machine ever shows —
 *   the P1/high/P2 scores, the high-score ranking table, the credit count, the extra-life/time HUD, the
 *   end-of-board bonus — is drawn as a run of these one-cell stamps.
 *
 * WHERE IT SITS
 *   The bottom of the digit-printing family. Its two direct callers chain it:
 *     • writePackedBcdByte (0x0ba0) calls it TWICE back-to-back — high nibble then low — to print one
 *       packed-BCD byte as two digits, without reloading the pointer between the two calls.
 *     • writeScoreField (0x0b95) uses it to append the fixed trailing "0" that Frogger's scores carry.
 *   Because those callers reuse the pointer this routine hands back rather than recomputing it, the
 *   stepped pointer is a real output, not just a convenience (see LIVE-OUT).
 *
 * HOW THE GLYPH WORKS
 *   No lookup table is involved: the tile index stored *is* the digit value. The character ROM lays out
 *   tiles 0..9 as the numeral glyphs 0..9, so writing the number writes the picture of the number. Only
 *   the low nibble is kept, which turns a packed-BCD nibble (0x0..0x9) straight into its glyph.
 *
 * WHY "STEP UP" MOVES SIDEWAYS
 *   On this Galaxian-derived, rotated display the tilemap is stored so that one visible character cell is
 *   32 tilemap cells away. Subtracting 32 from the pointer therefore walks one character cell ALONG the
 *   readout — a horizontal run of digits on screen is a run of cells 32 apart in memory. The subtraction
 *   wraps at 16 bits (the Z80 `dec` borrow), reproduced here with u16().
 *
 * LIVE-OUT
 *   Memory (the one tilemap cell it stamps) AND the stepped-up write pointer. It both writes the pointer
 *   back to m.regs.hl (the Z80 HL register) and returns it, so a caller mid-chain reads the advanced
 *   position from HL without touching memory.
 */
import { u16 } from "../../../core/int.js";

// A packed-BCD nibble occupies the low four bits; masking with 0x0f isolates the single digit to draw
// and, because the char ROM's tiles 0..9 are the glyphs 0..9, that masked value is also its tile index.
const LOW_NIBBLE = 0x0f;

// One visible character cell is one 32-cell tilemap row away on the rotated display, so stepping the
// pointer to the next digit position means moving it up exactly one row: subtract 32.
const ROW_UP = 32;

// digit / ptr default to the Z80 registers this routine reads in the ROM (A = the digit, HL = the write
// pointer), matching the hardware calling convention while still allowing an explicit-argument call.
export function writeScoreDigitStepUp(m, digit = m.regs.a, ptr = m.regs.hl) {
  const { mem8 } = m;

  // ── Stamp the glyph ──────────────────────────────────────────────────────────────────
  // Store the digit's low nibble directly into the tilemap cell under the pointer. That nibble is the
  // numeral (0..9) and, with no translation table, is also the char-ROM tile that renders it.
  mem8[ptr] = digit & LOW_NIBBLE;

  // ── Advance to the next display cell ─────────────────────────────────────────────────
  // Step the pointer up one 32-cell tilemap row (one character cell along the readout), wrapping at 16
  // bits. Both publish it to HL and return it, so a chained caller reuses the advanced pointer.
  return (m.regs.hl = u16(ptr - ROW_UP));
}
