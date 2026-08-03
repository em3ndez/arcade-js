// SPDX-License-Identifier: GPL-3.0-only
/**
 * publishFireSprites — publish the five fire records into five 4-byte sprite records in the DMA
 * shadow buffer.  ROM 0x34F3.
 *
 * Walks the five-record object array OBJ_ARRAY_64 (stride 0x20) and, for each record
 * whose occupancy flag (field +0, OBJ_ACTIVE) is non-zero, copies four of its fields
 * into a fresh 4-byte destination record, in this fixed field order:
 *
 *     destination +0  <-  object OBJ_X          (+3)
 *     destination +1  <-  object OBJ_SPRITE_CODE (+7)
 *     destination +2  <-  object OBJ_SPRITE_ATTR (+8)
 *     destination +3  <-  object OBJ_Y          (+5)
 *
 * which is the object-to-sprite field mapping used across this game (an object's X /
 * tile / attribute / Y land in sprite-record bytes +0 / +1 / +2 / +3). The occupancy
 * flag itself is NOT copied. An EMPTY object (flag 0) is skipped but STILL consumes a
 * destination record, so the destination records stay aligned one-to-one with the
 * source objects. Five source objects therefore always produce five destination
 * records; empty ones leave their four destination bytes untouched.
 *
 * DESTINATION ADVANCE (faithful detail): between occupied records the destination
 * pointer advances with a full 16-bit step (its increment can carry into the high
 * byte); between empty records it advances by four on the low byte only (no carry into
 * the high byte). The two modes differ only across a page boundary — latent here,
 * because the destination base is a fixed 0x69D0 and only five records are produced, so
 * the low byte never wraps. Reproduced so the behaviour stays identical if the base
 * ever changed. The source pointer likewise advances on its low byte within page 0x64.
 *
 * A LEAF over memory: reads OBJ_ARRAY_64 fields, writes the sprite-record region at
 * 0x69D0; calls nothing and returns nothing. It IS reached in a live run: ROM 0x30F6 is
 * not a routine, it is the `call 0x34f3` INSIDE loc_30ed (ROM 0x30ED = `cd fa 30 / cd 3c
 * 31 / cd b1 31 / cd f3 34 / c9`), and loc_30ed calls this routine directly today. Its
 * GATE record measures 1532 natural dispatches of loc_30ed over 4000 attract frames, of
 * which 481 take the full arm — i.e. 481 dispatches of this routine. (An earlier header
 * here said "not currently reached in a live run"; that was stale.)
 *
 * NAME — WHY "FIRE". OBJ_ARRAY_64 (0x6400) was grounded as the FIRES on the real ROM under
 * MAME 0.288, on a NATURAL zero-poke 25m run (scratchpad/grounding-object-arrays.md): zeroing
 * the five records' +0 erases the fireball from the screen completely (0 of 40 sampled frames)
 * while the barrels are statistically untouched, the tight A/B's first differing frame is a
 * single blob at this array's logged record position to the pixel, and boxes drawn at the
 * logged positions land on a fireball and nothing else on all four boards. HONEST FLOOR: the
 * X-pin POSITIVE control on this array is a NO-OP — the ROM recomputes +3 each frame — so the
 * identity rests on the kill control plus positional correlation, not on a coordinate command.
 * PUBLISH, not "gather": 0x69D0 is inside SPRITE_BUFFER, the block the i8257 DMAs to sprite RAM
 * every vblank, so these twenty bytes are what the video hardware reads. The grounding watched
 * exactly this output — every box drawn at a record's logged position contained a fireball.
 *
 * Memory-equivalent to the frozen oracle — equivalence-34f3.test.js.
 * GATE:     crafted entries on a real attract base — the full 32 occupancy patterns
 *           (each source object empty or occupied) with distinct per-field values, plus
 *           non-zero-but-not-bit0 flags; the destination region is pre-patterned so both
 *           a spurious write and a missing write show. The crafted set is what proves the
 *           equivalence; the routine's natural reachability is separately sourced from
 *           loc_30ed's GATE (481 full-arm dispatches in 4000 attract frames). Teeth: a
 *           swapped-field-order twin, a
 *           bit0-only occupancy twin, and an empty-does-not-advance twin.
 * LIVE-OUT: memory-only (the 0x69D0 sprite-record region). The oracle's residual
 *           registers/flags and its terminal return are dead ABI — the contract is the
 *           gathered records.
 * NAMES:    OBJ_ARRAY_64 (0x6400) and its field offsets OBJ_ACTIVE/OBJ_X/OBJ_SPRITE_CODE/
 *           OBJ_SPRITE_ATTR/OBJ_Y from ram.js. The destination base 0x69D0 (inside the
 *           sprite shadow buffer SPRITE_BUFFER, but not one of its named sub-bases) has
 *           no ram.js name and stays a local hex const.
 */

import {
  OBJ_ARRAY_64,
  OBJ_ACTIVE,
  OBJ_X,
  OBJ_Y,
  OBJ_SPRITE_CODE,
  OBJ_SPRITE_ATTR,
} from "./ram.js";

const OBJECT_COUNT = 5;      // records swept from OBJ_ARRAY_64
const OBJECT_STRIDE = 0x20;  // bytes between object records
const GATHER_DEST = 0x69d0;  // 4-byte destination records inside SPRITE_BUFFER (no ram.js name)

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function publishFireSprites(m) {
  const { mem } = m;

  const srcPage = OBJ_ARRAY_64 & 0xff00; // source stays in this page (0x6400)
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
