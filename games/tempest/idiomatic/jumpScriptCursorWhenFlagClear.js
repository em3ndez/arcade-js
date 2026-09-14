// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { SCRIPT_CURSOR, SCRIPT_BRANCH_FLAG, MOTION_SCRIPT_TABLE } from "./names.js";

// Bump the counter; then, only while the gate cell is zero, replace it with a
// table entry selected by the new counter value (a scripted jump).
export function jumpScriptCursorWhenFlagClear(m) {
  const { mem8 } = m;
  mem8[SCRIPT_CURSOR] = u8(mem8[SCRIPT_CURSOR] + 1);
  if (mem8[SCRIPT_BRANCH_FLAG] !== 0) return;
  const y = mem8[SCRIPT_CURSOR];
  mem8[SCRIPT_CURSOR] = mem8[u16(MOTION_SCRIPT_TABLE + y)];
}
