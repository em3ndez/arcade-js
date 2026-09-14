// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SCRIPT_CURSOR, SCRIPT_BRANCH_FLAG } from "./names.js";

// One demo-sequencer tick: while the hold gate is zero, advance the step counter by two.
export function skipScriptOperandWhenFlagClear(m) {
  const { mem8 } = m;
  if (mem8[SCRIPT_BRANCH_FLAG] !== 0) return;
  mem8[SCRIPT_CURSOR] = u8(mem8[SCRIPT_CURSOR] + 2);
}
