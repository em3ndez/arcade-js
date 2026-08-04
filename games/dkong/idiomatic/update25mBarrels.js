// SPDX-License-Identifier: GPL-3.0-only
/**
 * update25mBarrels — the head of the 25m barrel engine: on the girder board only, aim the
 * per-frame slot walk at the ten OBJ_ARRAY_67 barrel records and hand it the sprite cursor that
 * runs alongside them. On the other three boards it returns having touched nothing.
 *
 * WHAT IT DOES. One test, then a hand-off. If BOARD is not the girder board it returns at once,
 * so three quarters of the game never runs the walk at all. On the girder board it seeds the
 * walk's four working values — the record it starts on, the sprite cursor, the distance from one
 * record to the next, and how many records are left — and falls into the walk.
 *
 * THE TWO STRIDES ARE WHY THE CURSOR'S START ADDRESS IS MEANINGFUL RATHER THAN INCIDENTAL. The
 * walk advances the record pointer by one record stride and the sprite cursor by four bytes on
 * every iteration, so across the ten iterations the cursor sweeps exactly the ten stride-4
 * records at ACTOR_SPRITES and finishes one past the last of them. Only the cursor's low byte is
 * incremented, so the sweep cannot leave that page however the walk behaves.
 *
 * WHAT THE NAME RESTS ON, from this body alone: the board test is the routine's own first
 * instruction and it admits exactly ONE board, and every value it then seeds addresses the barrel
 * record array or its paired sprite records. A name naming any other board would be refuted by
 * that first test; a name naming any other array would be refuted by the two bases loaded here.
 *
 * NOT CLAIMED: which of the two writers of the ACTOR_SPRITES block owns which of its ten records.
 * This routine starts a cursor there; it is not the only routine that does, and nothing in this
 * file settles the division.
 *
 * Reads BOARD, and no other cell. Writes nothing of its own — every write the frame produces
 * from here is made inside the walk it falls into.
 *
 * LIVE-OUT: nothing. On the girder arm the walk overwrites every register before its own first
 * branch, and there is no return value on either arm.
 */

import { BOARD, OBJ_ARRAY_67, ACTOR_SPRITES } from "./names.js";

const GIRDER_BOARD = 1; // the BOARD value that runs the walk (25m)
const OBJECT_SLOTS = 10; // records in OBJ_ARRAY_67
const RECORD_STRIDE = 32; // bytes from one OBJ_ARRAY_67 record to the next

export function update25mBarrels(m) {
  const { regs, mem8 } = m;

  // Only the girder board walks the barrels; the other three leave them alone entirely.
  if (mem8[BOARD] !== GIRDER_BOARD) return;

  // REGISTER MARSHALLING: the walk takes its four working values out of the register file rather
  // than as arguments, so they are loaded here exactly as the hand-off leaves them.
  regs.ix = OBJ_ARRAY_67; // the record it starts on
  regs.hl = ACTOR_SPRITES; // the sprite cursor that advances 4 bytes per record
  regs.de = RECORD_STRIDE; // how far the record pointer moves each iteration
  regs.b = OBJECT_SLOTS; // how many records it has left to visit

  // Fall into the slot walk.
  return m.call(0x1f83);
}
