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

export function update25mBarrels(m) {
  const { regs, mem8 } = m;

  if (mem8[BOARD] !== GIRDER_BOARD) return;

  // The walk reads its four working values from registers rather than as arguments; seed them on
  // the tail-call return so the writes still land (left-to-right) before serviceBarrelSlotIfLive.
  return (regs.ix = OBJ_ARRAY_67), (regs.hl = ACTOR_SPRITES), (regs.de = RECORD_STRIDE), (regs.b = OBJECT_SLOTS), serviceBarrelSlotIfLive(m);
}
