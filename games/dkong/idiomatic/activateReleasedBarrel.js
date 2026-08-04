// SPDX-License-Identifier: GPL-3.0-only
/**
 * activateReleasedBarrel — the release-path renderer's 0x7F terminator: activate the barrel
 * record it was building and reload the ten-record sprite-object block.
 *
 * The renderer above walks a byte string, writing 4-byte sprite records, until it meets the
 * 0x7F terminator; that jump lands here to CLOSE OUT the object. The record being closed out
 * is a 25m barrel record: the caller leaves its base in the index register and the renderer's
 * destination pointer in the pair register. This routine:
 *   - Rewinds the string source pointer, RENDER_STR_PTR, back to the string's start.
 *   - Stamps the record's control fields: an enable/mode byte at +1 chosen from bit 0 of
 *     BARREL_CLAIM_MODE — bit 0 SET keeps mode 1, bit 0 CLEAR selects mode 0 and marks +2
 *     with 2 — then a fixed 1 at OBJ_ACTIVE and +0x0F, a zeroed sub-block +0x10..+0x14, and
 *     clears two engine-scratch bytes.
 *   - Copies the destination sprite record's X and Y into the barrel record's OBJ_X and
 *     OBJ_Y.
 *   - Reloads the whole ten-record sprite-object block from its stored template and adds -4
 *     to every record's Y field.
 *
 * BARREL_CLAIM_MODE is the barrel slot-claim mode byte, not a bare flag: its low bits carry
 * the claim's mode value and its bit 7 selects the barrel kind. This routine reads only bit 0.
 *
 * NOT CLAIMED: which barrel the two mode arms produce. The field layout and the mode select
 * are exact, but the identity of the two kinds is not established here, so the name says
 * "activate" and nothing about kind.
 *
 * LIVE-OUT: memory-only — the barrel record's control and position fields, the two scratch
 * bytes, and the reloaded, Y-shifted sprite-object block.
 */

import { RENDER_STR_PTR, SPRITE_OBJ_BLOCK, SPRITE_Y, BARREL_CLAIM_MODE,
         OBJ_ACTIVE, OBJ_X, OBJ_Y } from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";

const STRING_RESTART = 0x39c3; // string source rewound to the first byte
const SCRATCH_A = 0x6393; // cleared each terminator (shared engine scratch)
const SCRATCH_B = 0x6392; // cleared each terminator (shared engine scratch)
const SPRITE_TEMPLATE = 0x385c; // stored template reloaded into the sprite-object block
const Y_COLUMN_DELTA = 0xfc; // -4, added to every record's Y field

export function activateReleasedBarrel(m) {
  const { regs, mem } = m;

  const obj = regs.ix; // barrel record base, handed over by the caller
  const renderPtr = regs.de; // the renderer's destination pointer

  // Rewind the string source pointer to the start of the string.
  mem.write16(RENDER_STR_PTR, STRING_RESTART);

  // Record mode byte (+1), selected by bit0 of the slot-claim mode byte: SET keeps mode 1;
  // CLEAR selects mode 0 and additionally marks +2 with 2.
  if ((mem.read8(BARREL_CLAIM_MODE) & 0x01) !== 0) {
    mem.write8(obj + 0x01, 0x01);
  } else {
    mem.write8(obj + 0x01, 0x00);
    mem.write8(obj + 0x02, 0x02);
  }

  // Fixed control fields, a zeroed sub-block, and clear the two engine-scratch bytes.
  mem.write8(obj + OBJ_ACTIVE, 0x01);
  mem.write8(obj + 0x0f, 0x01);
  mem.write8(obj + 0x10, 0x00);
  mem.write8(obj + 0x11, 0x00);
  mem.write8(obj + 0x12, 0x00);
  mem.write8(obj + 0x13, 0x00);
  mem.write8(obj + 0x14, 0x00);
  mem.write8(SCRATCH_A, 0x00);
  mem.write8(SCRATCH_B, 0x00);

  // Copy the destination sprite record's position into the barrel record: the X byte
  // renderPtr points at into OBJ_X, and the sprite's Y into OBJ_Y.
  mem.write8(obj + OBJ_X, mem.read8(renderPtr));
  mem.write8(obj + OBJ_Y, mem.read8(renderPtr + SPRITE_Y));

  // Reload the ten-record sprite-object block from its stored template, then add -4 to the
  // whole block's Y column. Both callees take their inputs in registers, so load them here.
  regs.hl = SPRITE_TEMPLATE;
  loadSpriteObjectBlock(m); // copies 40 bytes from HL into SPRITE_OBJ_BLOCK

  regs.hl = SPRITE_OBJ_BLOCK + SPRITE_Y; // the Y column
  regs.c = Y_COLUMN_DELTA; // -4
  addToSpriteObjectColumn(m); // adds C into all ten Y fields
}
