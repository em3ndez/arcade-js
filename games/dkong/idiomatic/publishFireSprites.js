// SPDX-License-Identifier: GPL-3.0-only
/**
 * publishFireSprites — publish the five fire records into five 4-byte sprite records in the DMA
 * shadow buffer.
 *
 * Walks the five records of OBJ_ARRAY_64 (stride 0x20) and, for each record whose occupancy flag
 * OBJ_ACTIVE is non-zero, copies four of its fields into a fresh 4-byte destination record, in this
 * fixed field order:
 *
 *     destination +0  <-  OBJ_X
 *     destination +1  <-  OBJ_SPRITE_CODE
 *     destination +2  <-  OBJ_SPRITE_ATTR
 *     destination +3  <-  OBJ_Y
 *
 * which is the object-to-sprite field mapping used across this game. The occupancy flag itself is
 * NOT copied. An EMPTY record is skipped but STILL consumes a destination record, so destinations
 * stay aligned one-to-one with sources: five source objects always produce five destination records,
 * and an empty one simply leaves its four destination bytes untouched.
 *
 * DESTINATION ADVANCE, a faithful detail. Between occupied records the destination pointer advances
 * with a full 16-bit step, whose increment can carry into the high byte; past an empty record it
 * advances by four on the LOW BYTE ONLY, with no carry. The two modes differ only across a page
 * boundary, which is latent here — the destination base is fixed and only five records are produced,
 * so the low byte never wraps. It is reproduced so the behaviour stays identical if that base ever
 * moved. The source pointer likewise advances on its low byte, within its own page.
 *
 * PUBLISH, not "gather": the destination sits inside SPRITE_BUFFER, the block the DMA controller
 * copies into sprite RAM every vblank, so these twenty bytes are what the video hardware reads.
 *
 * WHAT THE NAME CLAIMS. The copy, the alignment rule and the destination are all derivable here.
 * That the source array holds the FIRES is not — the name carries that from evidence outside this
 * file.
 *
 * Reads: the OBJ_ACTIVE / OBJ_X / OBJ_SPRITE_CODE / OBJ_SPRITE_ATTR / OBJ_Y fields of the five
 * records. Writes: five 4-byte sprite records inside SPRITE_BUFFER.
 * LIVE-OUT: memory-only. A leaf — it calls nothing and returns nothing.
 */

import {
  OBJ_ARRAY_64,
  OBJ_ACTIVE,
  OBJ_X,
  OBJ_Y,
  OBJ_SPRITE_CODE,
  OBJ_SPRITE_ATTR,
} from "./names.js";

const OBJECT_COUNT = 5;      // records swept from OBJ_ARRAY_64
const OBJECT_STRIDE = 0x20;  // bytes between object records
const GATHER_DEST = 0x69d0;  // the 4-byte destination records, inside SPRITE_BUFFER

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function publishFireSprites(m) {
  const { mem } = m;

  const srcPage = OBJ_ARRAY_64 & 0xff00; // the source never leaves this page
  let objLo = OBJ_ARRAY_64 & 0xff;       // low byte of the current object base (0x00)
  let dst = GATHER_DEST;                 // 16-bit destination record pointer

  for (let i = 0; i < OBJECT_COUNT; i++) {
    // Occupancy flag (object field +0); zero means an empty slot.
    if (mem.read8(srcPage | ((objLo + OBJ_ACTIVE) & 0xff)) !== 0) {
      // Occupied: gather the four fields into this record, byte by byte. Within a
      // record the destination advances on its low byte only.
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_X) & 0xff)));           // record +0 = X
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_SPRITE_CODE) & 0xff))); // record +1 = tile code
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_SPRITE_ATTR) & 0xff))); // record +2 = attribute
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_Y) & 0xff)));           // record +3 = Y
      dst = (dst + 1) & 0xffff; // advance to the next record — this step can carry
    } else {
      // Empty: copy nothing, but still consume a record so records stay object-aligned.
      // The destination advances by four on the low byte only (no carry into the high byte).
      dst = (dst & 0xff00) | ((dst + 4) & 0xff);
    }

    // Advance the source to the next object (stride 0x20), on the low byte within the page.
    objLo = (objLo + OBJECT_STRIDE) & 0xff;
  }
}
