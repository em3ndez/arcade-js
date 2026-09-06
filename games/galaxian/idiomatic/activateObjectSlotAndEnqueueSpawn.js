// SPDX-License-Identifier: GPL-3.0-only
// Activate a free object slot: consume the trigger flag it was found under, mark the slot active with a
// cleared phase, record the spawn code and source index, then enqueue the spawn command word (type 1,
// source index). The source index is the low byte of the trigger pointer; that pointer is returned
// unchanged (the caller reads its low byte back).
import { enqueueCommandWord } from "./enqueueCommandWord.js";

// Object-record field offsets (base IX).
const OBJ_ACTIVE = 0;
const OBJ_PHASE = 2;
const OBJ_SPAWN_CODE = 6;
const OBJ_SOURCE_INDEX = 7;

export function activateObjectSlotAndEnqueueSpawn(m, trigger = m.regs.hl, obj = m.regs.ix, spawnCode = m.regs.c) {
  const { mem8 } = m;
  const sourceIndex = trigger & 0xff; // low byte of the trigger pointer

  mem8[trigger] = 0; // consume the trigger flag
  mem8[obj + OBJ_ACTIVE] = 1;
  mem8[obj + OBJ_PHASE] = 0;
  mem8[obj + OBJ_SPAWN_CODE] = spawnCode;
  mem8[obj + OBJ_SOURCE_INDEX] = sourceIndex;

  return enqueueCommandWord(m, (1 << 8) | sourceIndex, trigger);
}
