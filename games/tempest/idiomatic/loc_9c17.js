// SPDX-License-Identifier: GPL-3.0-only
import { SCRIPT_CURSOR, MOTION_SCRIPT_GOTO } from "./names.js";
import { u16 } from "../../../core/int.js";

// Table-driven state step: use the current index to fetch the next byte from a
// table and write it back as the new index.
export function loc_9c17(m) {
  const { mem8 } = m;
  const index = mem8[SCRIPT_CURSOR];
  mem8[SCRIPT_CURSOR] = mem8[u16(MOTION_SCRIPT_GOTO + index)];
}
