// SPDX-License-Identifier: GPL-3.0-only
/** negateVelocityIntoWorldScrollThenDressSprite — point the world the opposite way to the ship. Two velocity components arrive, each is
 * negated as a sixteen-bit quantity and stored as this frame's world scroll on its own axis, so the
 * scenery slides against the motion; the ship's sprite is then dressed for the way it is heading.
 * Neither component is read back here. LIVE-OUT: memory-only. */

import { u16 } from "../../../core/int.js";
import { dressPlayerSpriteForHeading } from "./dressPlayerSpriteForHeading.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "./names.js";

export function negateVelocityIntoWorldScrollThenDressSprite(m, alongY = m.regs.de, alongX = m.regs.bc) {
  const { mem16 } = m;
  mem16[WORLD_SCROLL_Y] = u16(-alongY);
  mem16[WORLD_SCROLL_X] = u16(-alongX);
  dressPlayerSpriteForHeading(m);
}
