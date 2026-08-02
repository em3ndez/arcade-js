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
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md): the object record this feeds is a 25m BARREL record, not a
 * cutscene element. RENDER_OBJ_PTR held only OBJ_ARRAY_67 record bases (0x6700 / 0x6720 /
 * 0x6740 / 0x6760 / 0x6780 / 0x67A0 / 0x67C0, stride 0x20 = the 25m barrel array) across the
 * run, matching the index register at 46/46 dispatches of the chain's head stampReleasedBarrelKind — all 46 at
 * gameplay substates (17 credited in-board 25m, 29 attract 25m demo), ZERO at substate 7, the
 * opening Kong-climb cutscene, and each paired 1:1 in the same frame with a slot claim by the
 * barrel-release routine (board 1, ROM 0x2CB8).
 *
 * NAME: kept loc_ — the record layout and the attribute-bit handling are pinned to the oracle,
 * and grounding fixes the CONTEXT (it fills an OBJ_ARRAY_67 barrel record on 25m). What is
 * still open is the NAMED identity of the two barrel kinds the chain's head selects between,
 * which the grounding run deliberately did not establish. Promote once that is corroborated.
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
 *           all from ram.js, as are the object record's sprite fields OBJ_SPRITE_CODE (+0x07)
 *           and OBJ_SPRITE_ATTR (+0x08). The destination slot is a 4-byte hardware sprite record,
 *           so its fields are the ram.js-named SPRITE_X (+0) / SPRITE_CODE (+1) / SPRITE_ATTR (+2)
 *           / SPRITE_Y (+3) and are imported from there too. The source string bytes live in ROM.
 */

import { RENDER_STR_PTR, RENDER_OBJ_PTR, RENDER_DST_PTR, OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR,
         SPRITE_X, SPRITE_CODE, SPRITE_ATTR, SPRITE_Y } from "./ram.js";
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
  mem.write8(dstPtr + SPRITE_X, ch & TERMINATOR);

  // SPRITE_CODE — the object record's OBJ_SPRITE_CODE field, its low two bits flipped when the character
  // carried the attribute bit; the (possibly flipped) value is written back to +7 too.
  let field = mem.read8(objPtr + OBJ_SPRITE_CODE);
  if ((ch & ATTRIBUTE_BIT) !== 0) field ^= FIELD_FLIP;
  mem.write8(dstPtr + SPRITE_CODE, field);
  mem.write8(objPtr + OBJ_SPRITE_CODE, field);

  // SPRITE_ATTR — copied straight from the object record's OBJ_SPRITE_ATTR field.
  mem.write8(dstPtr + SPRITE_ATTR, mem.read8(objPtr + OBJ_SPRITE_ATTR));

  // SPRITE_Y — the data byte that follows the character in the source string.
  mem.write8(dstPtr + SPRITE_Y, mem.read8(src + 1));

  // Advance the string cursor past the character and its data byte.
  mem.write16(RENDER_STR_PTR, src + 2);
}
