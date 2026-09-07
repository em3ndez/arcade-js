// SPDX-License-Identifier: GPL-3.0-only
/**
 * activateObjectSlotAndEnqueueSpawn — seed a claimed free object slot and enqueue its spawn command.
 *
 * WHAT IT IS
 *   The tail step shared by the free-slot finders. Once a caller has found a set trigger flag and a
 *   free object record, this consumes the trigger flag, marks the record active with a cleared phase,
 *   records the spawn code and the source index, and enqueues a type-1 spawn command word keyed by
 *   that source index. It returns the trigger pointer unchanged so the caller can read its low byte.
 *
 * ROLE IN THE MACHINE
 *   Tail-called from spawnIntoFreeDescriptorSlot (0x1446), spawnPrimaryAndSecondaryObjects (0x1472),
 *   and spawnObjectsFromTriggerFlags (0x14be), typically with IX pointing at a record in the object
 *   array (OBJ_TABLE 0x42d0 and neighbours). The record field roles are fixed by the render/AI
 *   convention: byte 0 bit 0 is the primary active flag, byte 2 the object-AI state index (0 = the
 *   first-tick spawn state), byte 6 the direction/spawn code, byte 7 the packed source/grid index.
 *   The source index is the low byte of the trigger pointer — the position of the flag within its
 *   block — and it keys the spawn command word (type 1) that enqueueCommandWord defers.
 *
 * ROM 0x145c.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: HL = trigger (returned unchanged); the command queue gains one word. The trigger flag and
 * the four record fields are written.
 */
import { enqueueCommandWord } from "./enqueueCommandWord.js";

// Object-record field offsets (base IX).
const OBJ_ACTIVE = 0;
const OBJ_PHASE = 2;
const OBJ_SPAWN_CODE = 6;
const OBJ_SOURCE_INDEX = 7;

export function activateObjectSlotAndEnqueueSpawn(m, trigger = m.regs.hl, obj = m.regs.ix, spawnCode = m.regs.c) {
  const { mem8 } = m;
  // The trigger pointer's low byte doubles as the source index: which flag in the block launched this
  // spawn. It is stamped into the record and keys the spawn command word.
  const sourceIndex = trigger & 0xff; // low byte of the trigger pointer

  // Consume the trigger flag (clear it so it does not re-fire), then seed the record: active flag set,
  // AI phase/state cleared to 0 (the first-tick spawn state), spawn code and source index recorded.
  mem8[trigger] = 0; // consume the trigger flag
  mem8[obj + OBJ_ACTIVE] = 1;
  mem8[obj + OBJ_PHASE] = 0;
  mem8[obj + OBJ_SPAWN_CODE] = spawnCode;
  mem8[obj + OBJ_SOURCE_INDEX] = sourceIndex;

  // Enqueue the type-1 spawn command word (high byte 1, low byte = source index); enqueueCommandWord
  // restores HL to the trigger pointer, which is this routine's return value.
  return enqueueCommandWord(m, (1 << 8) | sourceIndex, trigger);
}
