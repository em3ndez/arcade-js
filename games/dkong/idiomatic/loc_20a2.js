// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20a2 — on the first frame an airborne object's fall is arrested, decide whether the object
 * also turns round, then hand its record on to the tail that bounces it. The alternate kind turns
 * unconditionally; the default kind turns too, unless it has come to rest 22 rows or more below
 * Mario. It bounces on every arm.
 *
 * LIVE-OUT: memory, plus the propagated return value — this routine writes no register and no flag.
 */

import { u8, u16 } from "../../../core/int.js";
import { MARIO_Y, OBJ_Y } from "./names.js";

// +0x15 is the per-record kind index (only zero vs non-zero is drawn here); CLEARANCE is the
// distance in pixels the object must rest below Mario for the turn to be skipped.
const OBJ_KIND = 0x15;
const CLEARANCE_BELOW_MARIO = 22;

export function loc_20a2(m, record = m.regs.ix) {
  const { mem8 } = m;
  const at = (offset) => u16(record + offset);

  if (mem8[at(OBJ_KIND)] !== 0) return m.call(0x20b5);

  // The subtraction is a byte, so an object near the top of the screen wraps past every Mario
  // position and lands on the no-turn arm too.
  if (u8(mem8[at(OBJ_Y)] - CLEARANCE_BELOW_MARIO) >= mem8[MARIO_Y]) return m.call(0x20c3);

  return m.call(0x20b5);
}
