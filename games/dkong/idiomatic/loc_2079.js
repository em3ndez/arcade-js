// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2079 — retire the object record the movement walk was stepping, then hand the frame on to
 * the shared object-sprite tail. Clears OBJ_ACTIVE and OBJ_X and continues into the tail, which
 * copies four record fields into the sprite destination and re-enters the walk's loop advance —
 * so the retired record still shows a sprite this frame parked at X=0, and drops out of the walk
 * from the NEXT frame, when the per-slot check admits only records whose OBJ_ACTIVE is set.
 * @param {object} m  the machine.
 * @param {number} recordBase  the record to retire; must equal the machine's record pointer.
 * @returns {*} whatever the shared tail returns; propagated so a downstream skip isn't swallowed.
 */
import { OBJ_ACTIVE, OBJ_X } from "./names.js";

export function loc_2079(m, recordBase = m.regs.ix) {
  const { mem8 } = m;
  mem8[recordBase + OBJ_ACTIVE] = 0;
  mem8[recordBase + OBJ_X] = 0;
  return m.call(0x21ba);
}
