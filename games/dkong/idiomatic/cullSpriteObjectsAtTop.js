// SPDX-License-Identifier: GPL-3.0-only
/**
 * cullSpriteObjectsAtTop — over the ten 4-byte sprite-object records, zero the X (park at the left
 * edge) of any record whose Y has risen above the top line (smaller Y is higher). Leaves a scan
 * pointer and record stride each one short of what the follow-up sweep needs; the caller bumps both.
 *
 * LIVE-OUT: memory (the zeroed X bytes) plus that pointer/stride pair.
 */

import { u16 } from "../../../core/int.js";
import { SPRITE_OBJ_BLOCK } from "./names.js";

const RECORD_COUNT = 10;
const RECORD_STRIDE = 4; // +0 X, +1 code, +2 attr, +3 Y
const TOP_Y = 0x19;

export function cullSpriteObjectsAtTop(m) {
  const { mem8, regs } = m;

  for (let i = 0; i < RECORD_COUNT; i++) {
    const record = SPRITE_OBJ_BLOCK + i * RECORD_STRIDE;
    if (mem8[record + 3] < TOP_Y) {
      mem8[record] = 0x00;
    }
  }

  regs.hl = u16(SPRITE_OBJ_BLOCK - 1);
  regs.de = RECORD_STRIDE - 1;
}
