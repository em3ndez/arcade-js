// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1659 — step a moving object's walk animation, then build its record.  ROM 0x1659.
 *
 * The shared tail the tile-under-object classifier lands on when the object is on
 * open ground rather than settled on a solid tile (that settled case goes to the
 * plain record builder instead). It turns the object's travel into a walk cycle:
 *
 *   - The object's column is re-expressed as an offset from a moving reference
 *     point and stored back; the subtraction wraps within a byte.
 *   - An 8-step animation phase is read off that offset, with a small rounding bias
 *     so the frame flips at the right point. Phase 0 is the walk cycle's rest point.
 *   - A motion marker is set: 0 exactly at the rest point, otherwise the high-bit-set
 *     value the object-action dispatcher reads as "in motion".
 *   - The sprite frame alternates between two adjacent codes as the phase advances,
 *     giving the two-frame walk.
 *
 * It then hands the phase forward and tail-calls the record builder (loc_1b5b), whose
 * own return goes back to the classifier's caller — so this routine never returns on
 * its own path. loc_1b5b stays the frozen oracle (bottom-up order reaches it next).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1659.test.js.
 * GATE:     crafted-entry — reads only work RAM, so any real attract clone with its
 *           inputs poked is a valid entry (attract's demo never digs a moving object
 *           onto open ground, so it does not dispatch this naturally). The object
 *           logic depends only on (column - reference) mod 256, swept over all 256
 *           offsets; real captured attract states back it where reached.
 * LIVE-OUT: memory (column 0x8068, SPRITE_CODE, the 0x8075 motion marker, and the
 *           four record bytes loc_1b5b writes) plus the phase left in E for the
 *           record builder's caller; loc_1b5b overwrites A/F/B/HL, so those are dead.
 * NAMES:    OBJ_X, SPRITE_CODE from ram.js. The reference point 0x806c and the motion
 *           marker 0x8075 stay hex — their roles are not yet grounded.
 */

import { OBJ_X, SPRITE_CODE } from "./ram.js";

const REFERENCE = 0x806c; // moving reference point the object's column is measured against
const MOTION_FLAG = 0x8075; // 0 at rest, else the high-bit marker the action dispatch reads as moving

export function loc_1659(m) {
  const { regs, mem } = m;

  // Re-express the column as an offset from the reference point (wraps within a
  // byte) and store it back in place.
  const offset = (mem.read8(OBJ_X) - mem.read8(REFERENCE)) & 0xff;
  mem.write8(OBJ_X, offset);

  // The walk cycle: an 8-step phase taken off the offset, biased by 3 so the frame
  // flips at the right travel point. Phase 0 is the rest point.
  const phase = (offset + 3) % 8;

  // At rest only on phase 0; otherwise mark "in motion" with the high bit set, which
  // the object-action dispatcher tests as a negative marker.
  mem.write8(MOTION_FLAG, phase === 0 ? 0 : 0xff);

  // Two-frame walk: the sprite code steps to its odd neighbour on the half of the
  // cycle where phase bit 1 is set, back to the even code otherwise.
  mem.write8(SPRITE_CODE, phase & 2 ? 0xb3 : 0xb2);

  // Hand the phase forward and tail into the record builder; its return unwinds to
  // the classifier's caller.
  regs.e = phase;
  return m.call(0x1b5b);
}
