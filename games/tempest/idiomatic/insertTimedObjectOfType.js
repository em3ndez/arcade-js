// SPDX-License-Identifier: GPL-3.0-only
import { insertTimedObject } from "./insertTimedObject.js";
import { COORD_LIST_PTR_LO } from "./names.js";

/**
 * insertTimedObjectOfType — typed front door to the 8-slot timed-object table. ROM 0xa3d4.
 *
 * Role in the machine: callers that already know which kind of object they want to spawn
 * (the type byte arrives in A) enter here rather than at the bare insert. The only work this
 * entry adds over insertTimedObject is seating that type: it writes A into the shared type
 * scratch (loc_2c / COORD_LIST_PTR_LO) that the insert tail copies into the chosen slot's
 * type field, so the new object comes out tagged with the caller's kind.
 *
 * Behavior: stash A into the type scratch, then fall straight through to insertTimedObject,
 * passing the caller's X/Y untouched. It contributes no slot logic of its own.
 *
 * Live-out: the type scratch loc_2c (consumed by insertTimedObject) plus everything that
 * insertTimedObject leaves behind — the filled slot and the bumped live count.
 *
 * Grounding: [seen].
 */
// Stash A (the object type) into the shared type scratch, then run the common insert tail.
export function insertTimedObjectOfType(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_LO] = a;
  return insertTimedObject(m, x, y);
}
