// SPDX-License-Identifier: GPL-3.0-only
/** destroyPlayerAndObjectsTouchingIt — run one moving thing against a caller-supplied list of targets and destroy the ones
 * it has reached. The mover must still be live before anything is tested, so nothing happens once
 * it has already been spent. Each live target is then tested on both axes against the SAME window
 * width, which the caller supplies along with its slack, and a target inside both is marked
 * destroyed together with the mover — but the sweep runs on, so one pass can mark several.
 * How many targets there are is the caller's too, and it is the bottom of the loop that ends the
 * sweep: a count of zero walks the whole 256, which is what the count register means rather than
 * a special case. The two cursors advance differently: the occupancy cursor steps the LOW half of
 * its address only, so it wraps inside its own page, while the coordinate cursor steps whole.
 * Both are handed back where the sweep left them, one past the last target — and NOT advanced at
 * all when the mover was already spent, since that path never enters the sweep.
 * LIVE-OUT: memory, plus the two cursors. */

import { u8, u16 } from "../../../core/int.js";
import { PLAYER_STATE } from "./names.js";

const OCCUPANCY_STRIDE = 0x10;
const ENTRY_STRIDE = 2;

const ENTRY_FIRST_AXIS = 0;
const ENTRY_SECOND_AXIS = 0x31;
const MOVER_FIRST_AXIS = 0xaa10;
const MOVER_SECOND_AXIS = 0xaa41;

const LIVE = 0xff;
const DESTROYED = 0xf0;
const COUNT_ZERO_MEANS = 256;

export function destroyPlayerAndObjectsTouchingIt(
  m,
  occupancy = m.regs.de,
  entry = m.regs.iy,
  slack = m.regs.l,
  reach = m.regs.h,
  targets = m.regs.b,
) {
  const { mem8 } = m;
  if (mem8[PLAYER_STATE] !== LIVE) return;

  let occupancyAt = occupancy;
  let entryAt = entry;
  let left = targets === 0 ? COUNT_ZERO_MEANS : targets;
  while (left-- > 0) {
    if (mem8[occupancyAt] === LIVE) {
      const across = u8(mem8[MOVER_FIRST_AXIS] - mem8[entryAt + ENTRY_FIRST_AXIS] + slack);
      const along = u8(mem8[MOVER_SECOND_AXIS] - mem8[entryAt + ENTRY_SECOND_AXIS] + slack);
      if (across < reach && along < reach) {
        mem8[PLAYER_STATE] = DESTROYED;
        mem8[occupancyAt] = DESTROYED;
      }
    }
    occupancyAt = (occupancyAt & 0xff00) | u8(occupancyAt + OCCUPANCY_STRIDE);
    entryAt = u16(entryAt + ENTRY_STRIDE);
  }

  m.regs.e = occupancyAt;
  m.regs.iy = entryAt;
}
