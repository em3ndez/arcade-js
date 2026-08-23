// SPDX-License-Identifier: GPL-3.0-only
import { spawnObjectIntoFreeSlot } from "./spawnObjectIntoFreeSlot.js";
import { ENEMY_ACTOR_TABLE, SPRITE_OBJECT_TABLE } from "./names.js";
/**
 * loc_365d — pre-spawn gate.
 *
 * When the actor record's arm bit (rec+0x0b bit0) is set, require exactly one enemy-actor record
 * whose +0x02 state byte holds the spawn value; if the count is anything but one the gate bails.
 * When the arm bit is clear (or the count is exactly one) it seats the sprite-object scan window
 * and falls through to the slot scanner, whose result becomes this routine's result.
 *
 * SEATING: TAIL-CALL — seating is the slot scanner's. LIVE-OUT: none — a dispatched state handler;
 * the caller reloads A and reads no register back. On the bail path A is set to the last scanned
 * state byte as a harmless value result; the fall-through path forwards whatever the scanner leaves.
 */

const RECORD_STRIDE = 0x18;
const SCAN_RECORDS = 6;
const SLOT_COUNT = 0x05; // sprite-object window is 5 slots
const STATE_FIELD = 0x02; // +0x02 state byte of each enemy-actor record
const ARM_FIELD = 0x0b; //  rec+0x0b bit0 gates the count precondition
const SPAWN_STATE = 0x03; // state value counted by the precondition

export function loc_365d(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[rec + ARM_FIELD] & 0x01) {
    let count = 0;
    let state = 0;
    for (let k = 0; k < SCAN_RECORDS; k++) {
      state = mem8[ENEMY_ACTOR_TABLE + STATE_FIELD + k * RECORD_STRIDE];
      if (state === SPAWN_STATE) count++;
    }
    if (((count - 1) & 0xff) !== 0) return (m.regs.a = state); // not exactly one -> bail
  }

  // seat the sprite-object scan window, then fall through to the slot scanner
  return spawnObjectIntoFreeSlot(m, SPRITE_OBJECT_TABLE, RECORD_STRIDE, SLOT_COUNT, rec);
}
