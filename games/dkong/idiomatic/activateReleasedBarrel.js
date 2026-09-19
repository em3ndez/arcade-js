// SPDX-License-Identifier: GPL-3.0-only
/**
 * activateReleasedBarrel — the release renderer's terminator handler: close out the barrel
 * sprite record it was building and reload the ten-record sprite-object block.
 *
 * Rewinds the render string pointer; stamps the record's control fields (mode byte at +1
 * selected by bit 0 of BARREL_CLAIM_MODE, fixed 1 at OBJ_ACTIVE and +0x0F, zeroed +0x10..+0x14,
 * two cleared scratch bytes); copies the destination sprite's X/Y into OBJ_X/OBJ_Y; then
 * reloads the sprite-object block from its template and adds -4 to every record's Y.
 *
 * LIVE-OUT: memory-only — the barrel record's control and position fields, the two scratch
 * bytes, and the reloaded, Y-shifted sprite-object block.
 */

import {
  BARREL_CLAIM_MODE,
  BARREL_RELEASE_ARMED,
  loc_6393,
  OBJ_ACTIVE,
  OBJ_X,
  OBJ_Y,
  RENDER_STR_PTR,
  SPRITE_OBJ_BLOCK,
  SPRITE_Y,
} from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";

const STRING_RESTART = 0x39c3; // string source rewound to the first byte
const SPRITE_TEMPLATE = 0x385c; // stored template reloaded into the sprite-object block
const Y_COLUMN_DELTA = 0xfc; // -4, added to every record's Y field

export function activateReleasedBarrel(m, obj = m.regs.ix, renderPtr = m.regs.de) {
  const { regs, mem8, mem16 } = m;

  mem16[RENDER_STR_PTR] = STRING_RESTART;

  if ((mem8[BARREL_CLAIM_MODE] & 0x01) !== 0) {
    mem8[obj + 0x01] = 0x01;
  } else {
    mem8[obj + 0x01] = 0x00;
    mem8[obj + 0x02] = 0x02;
  }

  mem8[obj + OBJ_ACTIVE] = 0x01;
  mem8[obj + 0x0f] = 0x01;
  mem8[obj + 0x10] = 0x00;
  mem8[obj + 0x11] = 0x00;
  mem8[obj + 0x12] = 0x00;
  mem8[obj + 0x13] = 0x00;
  mem8[obj + 0x14] = 0x00;
  mem8[loc_6393] = 0x00;
  mem8[BARREL_RELEASE_ARMED] = 0x00;

  mem8[obj + OBJ_X] = mem8[renderPtr];
  mem8[obj + OBJ_Y] = mem8[renderPtr + SPRITE_Y];

  loadSpriteObjectBlock(m, SPRITE_TEMPLATE); // copies 40 bytes from HL into SPRITE_OBJ_BLOCK

  regs.hl = SPRITE_OBJ_BLOCK + SPRITE_Y; // the Y column
  regs.c = Y_COLUMN_DELTA; // -4
  addToSpriteObjectColumn(m); // adds C into all ten Y fields
}
