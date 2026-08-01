// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d8c — the string renderer's 0x7F terminator: reinitialise the object record it
 * was building and reload the ten-record sprite-object block.  ROM 0x2D8C.
 *
 * The renderer (loc_2d15 -> loc_2d54) walks a character string, writing 4-byte sprite
 * records, until it meets the 0x7F terminator byte; that jump lands here to CLOSE OUT
 * the object. The caller leaves the object record's base in the index register and the
 * renderer's destination pointer (RENDER_DST_PTR) in the pair register. This routine:
 *   - Rewinds the string source pointer (RENDER_STR_PTR) back to the string's start.
 *   - Stamps the record's control fields: an enable/mode byte at +1 chosen from bit0 of
 *     (0x6382) — bit0 SET keeps mode 1, bit0 CLEAR selects mode 0 and marks +2 with 2 —
 *     then a fixed 1 at +0 and +0x0F, a zeroed sub-block +0x10..+0x14, and clears two
 *     engine-scratch bytes (0x6392, 0x6393).
 *   - Copies two bytes out of the renderer's destination pointer into the record's +3
 *     and +5 fields (the byte there, then the byte three positions on).
 *   - Reloads the whole ten-record sprite-object block from the ROM template at 0x385C
 *     and adds -4 to every record's Y field.
 *
 * NAME: kept loc_ — the field layout and the (0x6382) mode select are pinned to the
 * oracle, but which renderer object this closes out (its game role) is not corroborated
 * to the routine-name bar.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2d8c.test.js.
 * GATE:     crafted-entry; reached in attract (13 real dispatches / 3000 frames, both
 *           (0x6382) bit0 arms observed) + crafted entries forcing each mode arm and
 *           distinctive source bytes. The RAM diff excludes the dead STACK_SCRATCH the
 *           oracle's two dissolved call brackets (0x004E and rst 0x38) push into.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and its terminal `ret`
 *           are dead ABI — the caller (a render loop) reads none of them; the single
 *           terminal return is modelled in the gate, not here.
 * NAMES:    RENDER_STR_PTR (0x62A8); SPRITE_OBJ_BLOCK (0x6908) + SPRITE_Y (+3) for the
 *           Y column. The object-record base and its field offsets (+0..+0x14) come from
 *           the caller (RENDER_OBJ_PTR) and have no per-field ram.js name; the (0x6382)
 *           mode byte and (0x6392/0x6393) scratch are unnamed engine scratch, kept hex.
 */

import { RENDER_STR_PTR, SPRITE_OBJ_BLOCK, SPRITE_Y } from "./ram.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004E
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)

const STRING_RESTART = 0x39c3; // string source rewound to the first byte
const MODE_SELECT = 0x6382; // bit0 selects the record's +1 enable/mode arm (engine scratch, unnamed)
const SCRATCH_A = 0x6393; // cleared each terminator (shared engine scratch, unnamed)
const SCRATCH_B = 0x6392; // cleared each terminator (shared engine scratch, unnamed)
const SPRITE_TEMPLATE = 0x385c; // ROM template reloaded into the sprite-object block
const Y_COLUMN_DELTA = 0xfc; // -4, added to every record's Y field

export function loc_2d8c(m) {
  const { regs, mem } = m;

  const obj = regs.ix; // object-record base (caller's RENDER_OBJ_PTR)
  const renderPtr = regs.de; // renderer's destination pointer (caller's RENDER_DST_PTR)

  // Rewind the string source pointer to the start of the string.
  mem.write16(RENDER_STR_PTR, STRING_RESTART);

  // Record mode byte (+1), selected by bit0 of (0x6382): SET keeps mode 1; CLEAR selects
  // mode 0 and additionally marks +2 with 2.
  if ((mem.read8(MODE_SELECT) & 0x01) !== 0) {
    mem.write8(obj + 0x01, 0x01);
  } else {
    mem.write8(obj + 0x01, 0x00);
    mem.write8(obj + 0x02, 0x02);
  }

  // Fixed control fields, a zeroed sub-block, and clear the two engine-scratch bytes.
  mem.write8(obj + 0x00, 0x01);
  mem.write8(obj + 0x0f, 0x01);
  mem.write8(obj + 0x10, 0x00);
  mem.write8(obj + 0x11, 0x00);
  mem.write8(obj + 0x12, 0x00);
  mem.write8(obj + 0x13, 0x00);
  mem.write8(obj + 0x14, 0x00);
  mem.write8(SCRATCH_A, 0x00);
  mem.write8(SCRATCH_B, 0x00);

  // Copy two bytes from the renderer's destination pointer into the record: the byte
  // there into +3, then the byte three positions on into +5.
  mem.write8(obj + 0x03, mem.read8(renderPtr));
  mem.write8(obj + 0x05, mem.read8(renderPtr + 3));

  // Reload the ten-record sprite-object block from its ROM template, then add -4 to the
  // whole block's Y column. Both callees still take their inputs in registers, so load
  // exactly what the oracle's call sites do.
  regs.hl = SPRITE_TEMPLATE;
  loadSpriteObjectBlock(m); // ROM 0x004E — copies 40 bytes from HL into SPRITE_OBJ_BLOCK

  regs.hl = SPRITE_OBJ_BLOCK + SPRITE_Y; // 0x690B, the Y column
  regs.c = Y_COLUMN_DELTA; // -4
  addToSpriteObjectColumn(m); // ROM 0x0038 (rst 0x38) — adds C into all ten Y fields
}
