// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { SCRIPT_CURSOR, SCRIPT_BRANCH_FLAG, MOTION_SCRIPT_TABLE } from "./names.js";

/**
 * jumpScriptCursorWhenFlagClear — the conditional-jump opcode of the motion script. ROM 0x9bfa.
 *
 * Role in the machine: Tempest drives enemy/attract motion from little byte-coded scripts, and
 * loc_10b (SCRIPT_CURSOR) is the program counter into one. This opcode always steps the cursor
 * forward one, and then — only when the branch-suppress flag loc_10c is clear — performs a jump:
 * it reads a target from the script table loc_a0f7 indexed by the just-advanced cursor and loads
 * that target back into the cursor, so the script resumes at a scripted position instead of the
 * next sequential slot. When loc_10c is nonzero the jump is suppressed and execution just falls
 * through to the following entry.
 *
 * Behavior: increment loc_10b (u8-wrapped). If loc_10c != 0, return with only the step applied.
 * Otherwise read y = loc_10b and overwrite the cursor with the table entry loc_a0f7[y].
 *
 * Live-out: the script cursor loc_10b — either advanced by one, or replaced with the jump target.
 *
 * Grounding: [seen].
 */
// Step the script cursor loc_10b forward one; then, only while branch flag loc_10c is clear,
// reload it from the script table loc_a0f7 indexed by the new cursor (the scripted jump).
export function jumpScriptCursorWhenFlagClear(m) {
  const { mem8 } = m;
  mem8[SCRIPT_CURSOR] = u8(mem8[SCRIPT_CURSOR] + 1); // advance the program counter
  if (mem8[SCRIPT_BRANCH_FLAG] !== 0) return;        // branch suppressed: fall through
  const y = mem8[SCRIPT_CURSOR];
  mem8[SCRIPT_CURSOR] = mem8[u16(MOTION_SCRIPT_TABLE + y)]; // jump: reload cursor from the table
}
