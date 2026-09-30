// SPDX-License-Identifier: GPL-3.0-only
/** driftAtThreeQuartersWorldScroll — carry one object along with the scrolling world, at three quarters of the pace.
 * Each of the object's two coordinates is 16 bits stored split: the whole part off one base, the
 * fraction off the other. Both are moved by a displacement read from a fixed pair of cells rather
 * than from the object, shortened by a quarter on the way in, so an object running this trails one
 * that takes the whole displacement. LIVE-OUT: memory only — four bytes, nothing clamped; the
 * second moved coordinate is also left standing in the pair the move hands it back through.
 *
 * ROM 0x2D93-0x2DB7 (frozen lift loc_2d93). Grounding: [seen] (names.js ROUTINES 0x2D93).
 *
 * Role in the machine: Time Pilot's ship never moves on the glass. Each frame its velocity is
 * turned into a displacement, negated, and stored in WORLD_SCROLL_Y (0xA808) [seen] and
 * WORLD_SCROLL_X (0xA80A) [seen]; everything else on screen is moved by that displacement so the
 * world appears to fly past. Scenery gets parallax from three sibling routines, each moving an
 * object by a different fraction of the displacement — driftAtHalfWorldScroll (half), this one
 * (three quarters) and driftAtFiveQuartersWorldScroll (five quarters). This is the middle rung.
 * Its callers are the scenery wrappers dispatched by the era-keyed scenery dispatcher, every
 * dispatch seated inside the scenery slots (names.js; mechanisms.md, the scroll and scenery section).
 *
 * Parameters: `object` is the object record (IX in the ROM), holding the fractional byte of each
 * coordinate; `sprite` is its sprite entry (IY in the ROM), holding the whole byte of each
 * coordinate — the bytes the video hardware reads as the sprite's position.
 */

import { displaceByThreeQuarters } from "./displaceByThreeQuarters.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "./names.js";

export function driftAtThreeQuartersWorldScroll(m, object = m.regs.ix, sprite = m.regs.iy) {
  /* First coordinate: whole at sprite +0x31 (49, native Y), fraction at record +3, moved by the
   * WORLD_SCROLL_Y component (ROM 0x2D93-0x2DA5: ld d,(iy+0x31) / ld e,(ix+0x03) /
   * ld hl,(0xa808) / call 0x303e). */
  moveCoordinate(m, sprite + 49, object + 3, m.mem16[WORLD_SCROLL_Y]);
  /* Second coordinate: whole at sprite +0 (native X), fraction at record +5, moved by the
   * WORLD_SCROLL_X component (ROM 0x2DA5-0x2DB7, same shape with 0xA80A). The board is rotated
   * (ROT90), so native X and Y are swapped relative to the glass — see names.js. */
  moveCoordinate(m, sprite, object + 5, m.mem16[WORLD_SCROLL_X]);
}

/** One coordinate: whole and fraction read as a single number, moved, then split back.
 * The ROM builds the number in DE (whole byte in D, fraction in E) and calls
 * displaceByThreeQuarters (0x303E), which adds the displacement less a quarter of it — the
 * quarter taken by a signed shift that rounds toward the negative — and returns the 16-bit sum in
 * HL (where it is left standing after the second call). The fraction carries into the whole, so
 * the coordinate moves and wraps as one number. */
function moveCoordinate(m, wholeAddr, fractionAddr, displacement) {
  const { mem8 } = m;
  const moved = displaceByThreeQuarters(m, displacement, (mem8[wholeAddr] << 8) + mem8[fractionAddr]);
  // Split back: high byte to the sprite entry (ld (iy+..),h), low byte to the record (ld (ix+..),l).
  mem8[wholeAddr] = moved >> 8;
  mem8[fractionAddr] = moved;
}
