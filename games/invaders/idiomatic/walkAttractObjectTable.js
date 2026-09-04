// SPDX-License-Identifier: GPL-3.0-only
import { walkObjectTable } from "./walkObjectTable.js";
import { ATTRACT_OBJECT_TABLE } from "./names.js";

/**
 * walkAttractObjectTable — attract-mode task bit2: walk the attract-demo object table.
 *
 * WHAT IT IS
 *   One of the three arms dispatchAttractTask selects from TASK_FLAGS. This is the bit2 arm: it runs the
 *   16-byte object/timer record walker over the ATTRACT-DEMO object table at ATTRACT_OBJECT_TABLE, rather than the
 *   in-game table (0x2010) the walker defaults to — hence the base is passed explicitly.
 *
 * ROLE IN THE MACHINE
 *   Called only from dispatchAttractTask when TASK_FLAGS (0x20c1) bit2 is set. runHandshakedAttractAnim
 *   block-copies a fixed descriptor (ROM 0x1bc0, handler target 0x050e = attractAnimHandler) into
 *   ATTRACT_OBJECT_TABLE; this walk counts that record's timers down and, on expiry, dispatches attractAnimHandler,
 *   which toggles ATTRACT_ANIM_ACK (0x2055) to complete the reveal-animation handshake. ATTRACT_OBJECT_TABLE is the
 *   attract-demo object-table base.
 *
 * ROM: composite wrapper — no separate cert entry in names.js. Its callee walkObjectTable is the
 * [seen] object dispatcher (mechanisms.md §"Object-table handlers").
 *
 * LIVE-OUT: whatever walkObjectTable leaves, since this tail-calls it.
 */
export function walkAttractObjectTable(m) {
  // Walk the object/timer records starting at the attract-demo table base (not the in-game default).
  return walkObjectTable(m, ATTRACT_OBJECT_TABLE);
}
