// SPDX-License-Identifier: GPL-3.0-only
/** markObjectsTouchingPlayer — mark every object in a run that has come within reach of one fixed reference
 * position, and only while a guard byte reads all-ones.
 *
 * Reach is a box, and the caller owns its shape: each axis is measured as the reference minus the
 * object, shifted by an offset and compared against a width, both taken from registers, and the
 * arithmetic wraps at a byte so the test is a wrapped distance rather than a range. An object
 * whose own state byte is not all-ones is skipped without being measured, and one inside the box
 * on BOTH axes has that state byte replaced by a different value — the only thing written. The
 * two cursors advance independently: the state byte's low half only, so the run stays inside one
 * page, and the coordinate cursor by an entry stride. A count of zero walks the whole 256, which
 * is what the count register means rather than a special case. LIVE-OUT: the state bytes. */

import { u8, u16 } from "../../../core/int.js";
import { PLAYER_ENTRY, PLAYER_SPRITE_Y, PLAYER_STATE } from "./names.js";

const SECOND_AXIS_OFFSET = 49;
const ENTRY_STRIDE = 2;
const STATE_STRIDE = 16;
const IN_PLAY = 0xff;
const MARKED = 0xf0;

export function markObjectsTouchingPlayer(m) {
  const { mem8, regs } = m;
  if (mem8[PLAYER_STATE] !== IN_PLAY) return;

  const offset = regs.l;
  const width = regs.h;
  const withinReach = (reference, coordinate) =>
    u8(mem8[reference] - mem8[coordinate] + offset) < width;

  const page = regs.d << 8;
  let index = regs.e;
  let entry = regs.iy;
  let left = regs.b;
  do {
    if (
      mem8[page + index] === IN_PLAY &&
      withinReach(PLAYER_ENTRY, entry) &&
      withinReach(PLAYER_SPRITE_Y, entry + SECOND_AXIS_OFFSET)
    ) {
      mem8[page + index] = MARKED;
    }
    index = u8(index + STATE_STRIDE);
    entry = u16(entry + ENTRY_STRIDE);
    left = u8(left - 1);
  } while (left !== 0);

  regs.e = index;
  regs.iy = entry;
  regs.b = 0;
}
