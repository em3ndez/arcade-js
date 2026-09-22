// SPDX-License-Identifier: GPL-3.0-only
/**
 * update25mBarrels — head of the 25m barrel engine. On the girder board only, seed the per-frame
 * slot walk over the ten OBJ_ARRAY_67 barrel records and hand it the sprite cursor; on the other
 * three boards it returns having touched nothing. The walk advances the record pointer one stride
 * and the sprite cursor four bytes each of ten iterations, sweeping the stride-4 ACTOR_SPRITES.
 * LIVE-OUT: nothing — the walk overwrites every register; neither arm returns a value.
 */

import { serviceBarrelSlotIfLive } from "./serviceBarrelSlotIfLive.js";
import { BOARD, OBJ_ARRAY_67, ACTOR_SPRITES } from "./names.js";

const GIRDER_BOARD = 1; // the BOARD value that runs the walk (25m)
const OBJECT_SLOTS = 10; // records in OBJ_ARRAY_67
const RECORD_STRIDE = 32;

const SPRITE_PAGE = ACTOR_SPRITES & ~0xff; // the fixed sprite-buffer page for the sweep (low byte cleared)
const SPRITE_CURSOR = ACTOR_SPRITES & 0xff; // the low-byte staging cursor, +4 per slot

export function update25mBarrels(m) {
  const { mem8 } = m;

  if (mem8[BOARD] !== GIRDER_BOARD) return;

  // Walk the ten barrel slots, servicing each and advancing the record pointer one stride and the
  // sprite cursor four bytes per iteration. The staging cursor is a plain JS value the walk owns.
  let cursor = SPRITE_CURSOR;
  let record = OBJ_ARRAY_67;
  for (let count = OBJECT_SLOTS; count; count--, cursor = (cursor + 4) & 0xff, record += RECORD_STRIDE) {
    serviceBarrelSlotIfLive(m, { page: SPRITE_PAGE, cursor }, record);
  }
}
