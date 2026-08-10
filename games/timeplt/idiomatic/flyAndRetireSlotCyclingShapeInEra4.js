// SPDX-License-Identifier: GPL-3.0-only
/** flyAndRetireSlotCyclingShapeInEra4 — fly one object a step along the velocity it carries, and retire its slot once that
 * step has put it on a retire line. In one era of the game, and only that one, the object is also
 * given the next frame of a fixed shape cycle before it moves; every other era leaves whatever
 * shape it already had. The retire is the last thing done, so the shape written this tick is
 * written to a slot that may go out in the same breath. LIVE-OUT: memory. */

import { ERA_INDEX } from "./names.js";
import { animateFixedShapeCycle } from "./animateFixedShapeCycle.js";
import { flyAlongStoredVelocity } from "./flyAlongStoredVelocity.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlot } from "./retireSlot.js";

const CYCLED_SHAPE_ERA = 4;

export function flyAndRetireSlotCyclingShapeInEra4(m) {
  if (m.mem8[ERA_INDEX] === CYCLED_SHAPE_ERA) animateFixedShapeCycle(m);
  flyAlongStoredVelocity(m);
  if (hasReachedRetireLine(m)) retireSlot(m);
}
