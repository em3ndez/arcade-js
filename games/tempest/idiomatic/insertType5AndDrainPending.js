// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_FINE_ANGLE } from "./names.js";
import { insertObjectAndSignalReady } from "./primeTopPriorityObject.js";

/**
 * insertType5AndDrainPending — spawn a type-5 object and consume one pending slot. ROM 0xa33a.
 *
 * Role in the machine: this is one of the small typed spawn wrappers on top of the shared
 * insert-and-signal-ready tail. It commits a fixed type-5 object into the 8-slot table (going
 * through insertObjectAndSignalReady, which also copies source/target lanes, fires the sound
 * gate, and raises the spawn-ready flags), then draws the pending-spawn counter loc_201 down
 * by one to record that this request has now been serviced.
 *
 * Behavior: call insertObjectAndSignalReady with type 0x05 and the caller's X/Y, then
 * decrement loc_201 (imported here as PLAYER_FINE_ANGLE). The shared tail itself sets loc_201
 * to 0x81 as its ready marker; this step nudges it back down as the pending count drains.
 *
 * Live-out: the newly seated slot and every flag the shared tail raises, plus the decremented
 * pending counter loc_201.
 *
 * Grounding: [seen].
 */
// Insert a fixed type-5 object through the shared tail, then step the pending counter loc_201 down one.
export function insertType5AndDrainPending(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  insertObjectAndSignalReady(m, 0x05, x, y);
  // Drain one pending spawn: the shared tail raises loc_201; here it steps back down by one.
  mem8[PLAYER_FINE_ANGLE] = mem8[PLAYER_FINE_ANGLE] - 1;
}
