// SPDX-License-Identifier: GPL-3.0-only
import { walkObjectTable } from "./walkObjectTable.js";
import { loc_2050 } from "./names.js";

// Attract task bit2: walk the attract-demo object/timer record table. Its base differs from the
// in-game table the walker defaults to, so the base is passed explicitly.
export function loc_0aab(m) {
  return walkObjectTable(m, loc_2050);
}
