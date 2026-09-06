// SPDX-License-Identifier: GPL-3.0-only
// Take the two's-complement of the swept formation word's low byte and broadcast it across the
// strided work-RAM table.
import { broadcastNegatedSweepToStridedTable } from "./broadcastNegatedSweepToStridedTable.js";
import { loc_420e } from "./names.js";

export function broadcastNegatedFormationSweepToStridedTable(m) {
  return broadcastNegatedSweepToStridedTable(m, m.mem8[loc_420e]);
}
