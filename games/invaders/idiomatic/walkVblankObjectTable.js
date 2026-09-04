// SPDX-License-Identifier: GPL-3.0-only
import { walkObjectTable } from "./walkObjectTable.js";
import { GAME_OBJECT_TABLE } from "./names.js";

// Seat the vblank object-table base, then walk it.
export function walkVblankObjectTable(m) {
  return walkObjectTable(m, GAME_OBJECT_TABLE);
}
