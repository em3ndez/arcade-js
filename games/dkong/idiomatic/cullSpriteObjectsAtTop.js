// SPDX-License-Identifier: GPL-3.0-only
/**
 * cullSpriteObjectsAtTop — clear the X of any sprite-object that has risen to the top of the
 * screen.
 *
 * Runs over the ten records of the sprite-object block, four bytes each: X, sprite code,
 * attribute, Y. For each record it reads the Y byte and, if that record has risen above the top
 * line — smaller Y is higher on this screen — zeroes the record's X, parking the sprite at the
 * left edge. Nothing else in any record is touched and each record is decided on its own, so the
 * pass is order-independent and reads the block low-to-high.
 *
 * It also leaves behind a scan pointer and a record stride, each ONE SHORT of the value that will
 * be used: the caller bumps both by one before handing them to the follow-up scan that decides
 * whether every sprite has now been swept off.
 *
 * A leaf: it reads and writes only the sprite-object block.
 *
 * LIVE-OUT: memory (the zeroed X bytes) plus that pointer/stride pair.
 */

import { SPRITE_OBJ_BLOCK } from "./names.js";

const RECORD_COUNT = 10; // the block holds ten 4-byte sprite-object records
const RECORD_STRIDE = 4; // +0 X, +1 code, +2 attr, +3 Y
const TOP_Y = 0x19; // screen Y line; a record with Y below it has risen off the top

export function cullSpriteObjectsAtTop(m) {
  const { mem, regs } = m;

  for (let i = 0; i < RECORD_COUNT; i++) {
    const record = SPRITE_OBJ_BLOCK + i * RECORD_STRIDE;
    if (mem.read8(record + 3) < TOP_Y) {
      mem.write8(record, 0x00); // Y above the top line -> park X at the left edge
    }
  }

  // The scan pointer and stride the follow-up sweep needs, each one short: the caller bumps
  // both by one before using them.
  regs.hl = (SPRITE_OBJ_BLOCK - 1) & 0xffff;
  regs.de = RECORD_STRIDE - 1;
}
