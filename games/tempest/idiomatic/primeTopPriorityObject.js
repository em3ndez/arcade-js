// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, COORD_LIST_PTR_LO, COORD_LIST_PTR_HI, OBJECT_ANIM_PHASE, OBJECT_ANIM_TIMER, PLAYER_SEGMENT, PLAYER_FINE_ANGLE, PLAYER_SHOT_DEPTH } from "./names.js";
import { gateSound5f } from "./gateSound5f.js";
import { insertTimedObject } from "./insertTimedObject.js";

/**
 * insertObjectAndSignalReady -- the shared insert tail: seat an object then flag the spawn ready. ROM 0xa352.
 *
 * Role in the machine: the common back half of every top-object spawn in Tempest. Given the type byte in
 * A, it stamps the object's type, snapshots the current shot depth and player segment as the object's
 * source/target, plays the spawn sound, inserts the object into the 8-slot moving-object table, and then
 * raises the two ready flags the frame loop watches.
 *
 * Behavior: writes the type byte A into COORD_LIST_PTR_LO ($2c); copies PLAYER_SHOT_DEPTH ($202) into
 * loc_29 as the object's source; copies PLAYER_SEGMENT ($200) into COORD_LIST_PTR_HI ($2d) as the
 * target; calls gateSound5f(m,x,y) to fire the spawn sound; calls insertTimedObject(m,x,y) to seat the
 * object in the 8-slot table; then latches PLAYER_FINE_ANGLE ($201)=0x81 and OBJECT_ANIM_TIMER ($13c)=0x01.
 *
 * Live-out: $2c type, loc_29 source, $2d target, the inserted table slot + sound state, and the ready
 * flags $201=0x81 / $13c=0x01. Grounding: [seen].
 */
export function insertObjectAndSignalReady(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_LO] = a;                     // seat the type byte ($2c)
  mem8[loc_29] = mem8[PLAYER_SHOT_DEPTH];          // source = current shot depth ($202)
  mem8[COORD_LIST_PTR_HI] = mem8[PLAYER_SEGMENT];  // target = player segment ($200)
  gateSound5f(m, x, y);                            // fire the spawn sound gate
  insertTimedObject(m, x, y);                      // insert into the 8-slot moving-object table
  mem8[PLAYER_FINE_ANGLE] = 0x81;                  // ready flag: bit7 pending + low marker ($201)
  mem8[OBJECT_ANIM_TIMER] = 0x01;                  // arm the object's animation timer ($13c)
}

/**
 * insertType1WithHeadFlag -- stamp the head flag, then insert a type-1 object. ROM 0xa34d.
 *
 * Role in the machine: the middle layer of the spawn chain. It writes the caller's value into the head
 * flag OBJECT_ANIM_PHASE ($13b) -- which selects the object's leading animation phase -- and then runs
 * the shared insert tail with a fixed type byte of 0x01 (a type-1 object).
 *
 * Live-out: OBJECT_ANIM_PHASE ($13b) plus everything insertObjectAndSignalReady writes. Grounding: [seen].
 */
export function insertType1WithHeadFlag(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  m.mem8[OBJECT_ANIM_PHASE] = a;                   // head/phase flag from the caller ($13b)
  return insertObjectAndSignalReady(m, 0x01, x, y); // type-1 insert through the shared tail
}

/**
 * primeTopPriorityObject -- prime a fresh top-priority object. ROM 0xa34b.
 *
 * Role in the machine: the public entry the game calls to spawn the highest-priority object (e.g. the
 * one arriving at the player's segment). It seeds the head flag with 0xff -- the "top priority" phase
 * marker -- and delegates to the type-1 insert chain above.
 *
 * Live-out: OBJECT_ANIM_PHASE ($13b)=0xff plus the full insert tail's writes. Grounding: [seen].
 */
export function primeTopPriorityObject(m, x = m.regs.x, y = m.regs.y) {
  return insertType1WithHeadFlag(m, 0xff, x, y);   // head flag 0xff = top priority, then type-1 insert
}
