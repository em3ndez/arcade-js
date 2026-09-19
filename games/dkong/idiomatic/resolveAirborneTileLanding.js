// SPDX-License-Identifier: GPL-3.0-only
/**
 * resolveAirborneTileLanding — resolve whether Mario's airborne descent has reached a tile
 * surface; on a hit, snap him onto it and abort the collision probe walk.
 *
 * LIVE-OUT: MARIO_Y on the at-or-below arm; the result code (2 = airborne, 1 = landed) and
 * its twin; and the caller-skip boolean, where false is the two-frame unwind.
 */

import { u8, u16 } from "../../../core/int.js";
import { MARIO_AIR_PREV_Y, MARIO_Y } from "./names.js";

export function resolveAirborneTileLanding(m, boundary = m.regs.c, ix = m.regs.ix, e = m.regs.e) {
  const { regs, mem8 } = m;

  const objectY = mem8[u16(ix + 5)];
  const probe = u8(mem8[MARIO_AIR_PREV_Y] - objectY + e);

  if (probe > boundary) {
    regs.a = 2;
    regs.b = 0;
    return true;
  }

  mem8[MARIO_Y] = boundary - 7;
  regs.a = 1;
  regs.b = 1;
  return false;
}
