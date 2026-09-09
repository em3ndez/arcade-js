// SPDX-License-Identifier: GPL-3.0-only
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";

/**
 * plotNormalizedCharCode — map one raw character-or-nibble code to its actual font-tile code and
 * plot it through the shared draw cursor.
 *
 * Role in the machine: this is the character-normalizing layer that sits between the readout
 * builders (`plotByteAsTwoDigits`, `plotConfigTableRow`) and the raw store primitive. The ROM's
 * font ROM does not lay glyphs out at their ASCII/nibble values, so every printable code has to be
 * folded into the tile-code range before it can be stored. Two input conventions share this one
 * routine, selected by the entry carry:
 *   - Carry CLEAR — the input is a plain character code: bit 5 (0x20) is folded on to reach the
 *     letter/symbol tile band.
 *   - Carry SET — the input is a hex digit: only the low nibble is kept, and bit 5 is folded on
 *     unless the nibble is zero. Keeping a zero nibble un-folded (tile 0x00) is what lets a caller
 *     BLANK a leading zero instead of printing "0".
 * Either way, any code that has climbed to 0x2a or above is wrapped back down by 0x29 to keep it
 * inside the font's tile range. The normalized byte is then handed to the store primitive, which
 * draws it and steps the cursor one tile.
 *
 * Grounding: [code] — the normalization arithmetic is read from behaviour; the downstream
 * `writeMaskedByteAndAdvancePointer` store is the MAME-observed primitive.
 *
 * Live-out (register-out): the EXIT CARRY — set only when the entry carry held AND the low nibble
 * was zero, i.e. "this digit was a leading zero". Exposed as `return (m.regs.fC = exitCarry)` so a
 * caller can both read it as the returned boolean and find it on the flag bridge. It is the signal
 * that drives leading-zero suppression across a multi-digit field.
 */
export function plotNormalizedCharCode(m, a = m.regs.a, carrySet = m.regs.fC) {
  let v = a & 0xff;
  // Compute the exit carry NOW, from the ENTRY state, before v is normalized. On the 6502 the
  // exit carry is php-saved before the store and restored by the matching plp (the store's own
  // carry is discarded): it is set only when the entry carry held AND the incoming low nibble was
  // zero -- the sole path that reaches the php without an intervening clc. Capturing it here mirrors
  // that php-before-mutate ordering.
  const exitCarry = carrySet && (v & 0x0f) === 0;
  if (carrySet) {
    // Hex-digit mode: throw away the high nibble and keep the digit. Fold bit 5 on to reach the
    // digit-glyph band -- but ONLY for a non-zero digit, so a zero digit stays tile 0x00 (blank),
    // which is exactly what the leading-zero blanking relies on.
    v &= 0x0f;
    if (v !== 0) v = (v | 0x20) & 0xff;
  } else {
    // Plain-character mode: fold bit 5 on unconditionally to reach the letter/symbol tile band.
    v = (v | 0x20) & 0xff;
  }
  // Range wrap: any code that has reached 0x2a or higher is pulled back down by 0x29 so it lands
  // inside the font ROM's tile range instead of running off the end of the glyph set.
  if (v >= 0x2a) v = (v - 0x29) & 0xff;
  // Emit the finished tile code through the single store step, which XORs the flip mask, writes it
  // at the cursor, and advances the cursor one tile.
  writeMaskedByteAndAdvancePointer(m, v);
  return (m.regs.fC = exitCarry); // expose the true exit carry (register-out), not the store's carry
}
