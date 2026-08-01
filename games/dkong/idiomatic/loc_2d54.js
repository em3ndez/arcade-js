// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d54 — the string renderer's per-character body: emit one 4-byte sprite record
 * for the next character of the string, or hand off to the terminator.  ROM 0x2D54.
 *
 * The renderer (loc_2d15 -> loc_2d51 / loc_2d83) sets up the source-string pointer and
 * calls here once per character. The caller leaves the current source pointer in the
 * string-cursor register; this routine also picks up the object-record pointer
 * (RENDER_OBJ_PTR) and the destination-slot pointer (RENDER_DST_PTR) from RAM.
 *
 * It reads the next character byte at the string cursor. On the 0x7F terminator it
 * hands off to loc_2d8c to close the object out (loc_2d8c reads the object-record and
 * destination pointers, so those are marshalled into registers first). Otherwise it
 * writes one 4-byte record at the destination pointer and advances the string cursor by
 * two source bytes:
 *   +0  the character with its top (attribute) bit stripped.
 *   +1  the object record's +7 field; if the character's top bit was SET the field's low
 *       two bits are flipped (xor 0x03) first. The (possibly flipped) value is also
 *       stored back into the object record's +7 field.
 *   +2  the object record's +8 field.
 *   +3  the NEXT source byte (the data byte that follows the character).
 * The advanced source cursor (start + 2) is stored back into RENDER_STR_PTR.
 *
 * NAME: kept loc_ — the record layout and the attribute-bit handling are pinned to the
 * oracle, but which renderer object this feeds (its game role) is not corroborated to
 * the routine-name bar. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2d54.test.js.
 * GATE:     hook 0x2D54 in a real attract run and clone at each true dispatch (both the
 *           terminator and the emit-a-record paths occur naturally), plus crafted entries
 *           that force the terminator, both attribute-bit arms, and distinctive source
 *           bytes. The RAM diff excludes the dead STACK_SCRATCH the oracle's terminator
 *           hand-off (loc_2d8c's dissolved call brackets) pushes into.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and its terminal `ret`
 *           are dead ABI — the caller (a per-frame render call) reads none of them; the
 *           single terminal return is modelled in the gate, not here.
 * NAMES:    RENDER_STR_PTR (0x62A8), RENDER_OBJ_PTR (0x62AA), RENDER_DST_PTR (0x62AC),
 *           all from ram.js. The object record (+7/+8) and the destination slot (+0..+3)
 *           are reached through those runtime pointers and have no per-field ram.js name;
 *           the source string bytes live in ROM.
 */

import { RENDER_STR_PTR, RENDER_OBJ_PTR, RENDER_DST_PTR } from "./ram.js";
import { loc_2d8c } from "./loc_2d8c.js"; // ROM 0x2D8C — the 0x7F terminator hand-off

const TERMINATOR = 0x7f; // end-of-string sentinel; also the attribute-bit mask boundary
const ATTRIBUTE_BIT = 0x80; // character bit7: when set, flip the record's +1 low two bits
const FIELD_FLIP = 0x03; // the low-two-bit flip applied to the object record's +7 field

export function loc_2d54(m) {
  const { regs, mem } = m;

  const src = regs.hl; // string cursor (caller's source pointer)
  const objPtr = mem.read16(RENDER_OBJ_PTR); // object record being filled
  const dstPtr = mem.read16(RENDER_DST_PTR); // destination sprite-record slot
  const ch = mem.read8(src); // the next character byte

  // Terminator: close the object out. loc_2d8c reads the object-record and destination
  // pointers from registers, so marshal exactly what the oracle's call site holds.
  if (ch === TERMINATOR) {
    regs.ix = objPtr;
    regs.de = dstPtr;
    return loc_2d8c(m);
  }

  // +0 — the character with its attribute (top) bit stripped.
  mem.write8(dstPtr, ch & TERMINATOR);

  // +1 — the object record's +7 field, its low two bits flipped when the character
  // carried the attribute bit; the (possibly flipped) value is written back to +7 too.
  let field = mem.read8(objPtr + 0x07);
  if ((ch & ATTRIBUTE_BIT) !== 0) field ^= FIELD_FLIP;
  mem.write8(dstPtr + 1, field);
  mem.write8(objPtr + 0x07, field);

  // +2 — the object record's +8 field.
  mem.write8(dstPtr + 2, mem.read8(objPtr + 0x08));

  // +3 — the data byte that follows the character in the source string.
  mem.write8(dstPtr + 3, mem.read8(src + 1));

  // Advance the string cursor past the character and its data byte.
  mem.write16(RENDER_STR_PTR, src + 2);
}
