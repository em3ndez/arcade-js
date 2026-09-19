// SPDX-License-Identifier: GPL-3.0-only
/**
 * publishFireSprites — publish the five OBJ_ARRAY_64 records into five 4-byte sprite records
 * in the DMA shadow buffer, copying X, sprite code, attribute and Y in that order. An empty
 * record (OBJ_ACTIVE zero) is skipped but still consumes a destination record, keeping sources
 * and destinations one-to-one.
 *
 * Faithful detail: past an occupied record the destination advances 16-bit (can carry); past
 * an empty one it advances four on the low byte only. The difference is latent here — the base
 * is fixed and the low byte never wraps — but reproduced in case the base ever moves.
 *
 * LIVE-OUT: memory-only.
 */

import { u16 } from "../../../core/int.js";
import {
  OBJ_ARRAY_64,
  OBJ_ACTIVE,
  OBJ_X,
  OBJ_Y,
  OBJ_SPRITE_CODE,
  OBJ_SPRITE_ATTR,
  FIRE_SPRITES,
} from "./names.js";

const OBJECT_COUNT = 5;
const OBJECT_STRIDE = 0x20;

export function publishFireSprites(m) {
  const { mem8 } = m;

  const srcPage = OBJ_ARRAY_64 & 0xff00; // the source never leaves this page
  let objLo = OBJ_ARRAY_64 & 0xff;
  let dst = FIRE_SPRITES;

  for (let i = 0; i < OBJECT_COUNT; i++) {
    if (mem8[srcPage | ((objLo + OBJ_ACTIVE) & 0xff)] !== 0) {
      mem8[dst] = mem8[srcPage | ((objLo + OBJ_X) & 0xff)];
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem8[dst] = mem8[srcPage | ((objLo + OBJ_SPRITE_CODE) & 0xff)];
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem8[dst] = mem8[srcPage | ((objLo + OBJ_SPRITE_ATTR) & 0xff)];
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem8[dst] = mem8[srcPage | ((objLo + OBJ_Y) & 0xff)];
      dst = u16(dst + 1); // next record — this step can carry
    } else {
      // Empty: consume a record without copying; low-byte-only advance, no carry.
      dst = (dst & 0xff00) | ((dst + 4) & 0xff);
    }

    objLo = (objLo + OBJECT_STRIDE) & 0xff;
  }
}
