// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, loc_2b, SAVED_INDEX2 } from "./names.js";
import { dispatchCoordListSetup } from "./dispatchCoordListSetup.js";
import { seatCoordListPointer } from "./seatCoordListPointer.js";

/**
 * setupEnemyCoordList -- build the coordinate/shape list for a packed enemy index. ROM 0x9b07.
 *
 * Role in the machine: enemies draw from per-shape coordinate lists; this seats the pointer to the
 * right list for the packed index held in loc_2b, so the spawner/renderer can walk that shape. It is
 * called during enemy spawn and replacement, and it saves and restores the caller's index register in
 * SAVED_INDEX2 so the caller's Y survives the setup.
 *
 * Behavior: it stashes the caller's Y into SAVED_INDEX2, reads the packed index from loc_2b, then
 * branches on the held count loc_29. When loc_29 is 0x20 or more the index selects one of the
 * list-setup entries through the dispatcher dispatchCoordListSetup (slot x threaded on); otherwise
 * the pointer pair is seated directly at that index via seatCoordListPointer. It then reloads Y from
 * SAVED_INDEX2 and returns it, so the caller's index comes back unchanged.
 *
 * Live-out: the seated coordinate-list pointer (written by the callee), SAVED_INDEX2, and the Y
 * register restored to the caller's original index. Grounding: [seen].
 */
export function setupEnemyCoordList(m, y = m.regs.y, x = m.regs.x) {
  const { mem8 } = m;
  mem8[SAVED_INDEX2] = y;
  const idx = mem8[loc_2b];
  if (mem8[loc_29] >= 0x20) {
    dispatchCoordListSetup(m, idx, x); // slot x threaded on to the list-setup dispatch
  } else {
    seatCoordListPointer(m, idx);
  }
  return (m.regs.y = mem8[SAVED_INDEX2]);
}
