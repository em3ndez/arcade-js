// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearStridedTable -- per-state reset that zeroes the strided work-RAM table.
 *
 * WHAT IT IS
 *   A thin wrapper. It calls the shared block writer broadcastToStridedTable (0x0972, imported here under
 *   its ROM name loc_0972) with a fill value of 0, which broadcasts that value across the nine-cell
 *   stride-2 table at 0x4028 (cells 0x4028, 0x402a, ... , 0x4038). Passing 0 is the "clear" case of a
 *   writer that can broadcast any byte down that lane.
 *
 * ROLE IN THE MACHINE
 *   A shared per-frame/per-state housekeeping step reused by several sequence and play handlers
 *   (emitMessageColumnsThenAdvanceSequence, blankVramRowThenResetSpriteState, dwellThenAdvanceSequence,
 *   ...): it wipes that scratch table each tick so stale values from a prior state cannot leak forward.
 *
 * ROM 0x0363.  Grounding: [seen].
 *
 * LIVE-OUT: the stride-2 table at 0x4028..0x4038 (nine cells) := 0.  Returns whatever the block writer
 *   returns; callers here use it for effect only.
 */
import { broadcastToStridedTable as loc_0972 } from "./broadcastToStridedTable.js";

export function clearStridedTable(m) {
  // Broadcast 0 down the stride-2 table; the shared writer handles the base/stride/count.
  return loc_0972(m, 0);
}
