// SPDX-License-Identifier: GPL-3.0-only
/** flyAndRetireSlotCyclingShapeInEra4 — fly one object a step along the velocity it carries, and retire its slot once that
 * step has put it on a retire line. In one era of the game, and only that one, the object is also
 * given the next frame of a fixed shape cycle before it moves; every other era leaves whatever
 * shape it already had. The retire is the last thing done, so the shape written this tick is
 * written to a slot that may go out in the same breath.
 *
 * ROM 0x3E6C-0x3E7D (frozen lift translated/loc_3e6c.js). Grounding: [seen] (names.js ROUTINES 0x3e6c).
 *
 * Role in the machine: a per-slot object handler that strings three helpers together — shape,
 * move, boundary test — with retireSlot as the tail when the test says the object has arrived.
 * `record` is the object's record (IX on the Z80), `entry` its sprite entry (IY).
 *
 * LIVE-OUT: memory. */

import { ERA_INDEX } from "./names.js";
import { animateFixedShapeCycle } from "./animateFixedShapeCycle.js";
import { flyAlongStoredVelocity } from "./flyAlongStoredVelocity.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlot } from "./retireSlot.js";

// ERA_INDEX counts eras 0-4; the ROM's `cp 0x04` makes 4, the last, the one that cycles the shape.
const CYCLED_SHAPE_ERA = 4;

export function flyAndRetireSlotCyclingShapeInEra4(m, record = m.regs.ix, entry = m.regs.iy) {
  // Shape first, and only in era 4 (the ROM's `call z,0x3e7e`).
  if (m.mem8[ERA_INDEX] === CYCLED_SHAPE_ERA) animateFixedShapeCycle(m, entry);
  // Move by the velocity banked in the record, carried with the world scroll.
  flyAlongStoredVelocity(m, record, entry);
  // Landed on a retire line: free the slot (the ROM's `ret nc` falls through to a jump to 0x40AB).
  if (hasReachedRetireLine(m, entry)) retireSlot(m, record, entry);
}
