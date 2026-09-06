// SPDX-License-Identifier: GPL-3.0-only
// Aim an object at the target: derive the direction octant from the vertical drop to the sprite and the
// horizontal delta to the target-X anchor, and store it in the object's direction field. A target to the
// left is handled by mirroring the magnitude through the octant helper and negating the result.
import { loc_11d0 } from "./loc_11d0.js";
import { loc_4202 } from "./names.js";

const OBJ_Y = 3;   // sprite Y within the IX object record
const OBJ_X = 4;   // sprite X
const OBJ_DIR = 5; // direction octant (output)

export function loc_11b0(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Vertical delta: from the top of the play area (0xf0) down to the sprite -- the slope's divisor.
  const vertical = (0xf0 - mem8[obj + OBJ_Y]) & 0xff;

  // Horizontal delta from the sprite to the target-X anchor; negative means the target is to the left.
  const horizontal = mem8[loc_4202] - mem8[obj + OBJ_X];

  if (horizontal < 0) {
    // Target to the left: octant of the mirrored magnitude, then mirror the octant back.
    const octant = loc_11d0(m, (-horizontal) & 0xff, vertical);
    const mirrored = (-octant) & 0xff;
    mem8[obj + OBJ_DIR] = mirrored;
  } else {
    mem8[obj + OBJ_DIR] = loc_11d0(m, horizontal, vertical);
  }
}
