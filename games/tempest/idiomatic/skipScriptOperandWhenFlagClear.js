// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SCRIPT_CURSOR, SCRIPT_BRANCH_FLAG } from "./names.js";

/**
 * skipScriptOperandWhenFlagClear -- conditional-skip script opcode. ROM 0x9bee.
 *
 * Role in the machine: an opcode in the attract/demo script sequencer. Its job is to step the script
 * cursor past a two-byte operand when a branch flag is clear, so a conditional in the script can skip
 * over its inline argument rather than execute it.
 *
 * Behavior: if the branch flag SCRIPT_BRANCH_FLAG is nonzero it does nothing (the operand is consumed
 * on the taken path elsewhere); otherwise it advances the script cursor SCRIPT_CURSOR by two, stepping
 * past the two-byte operand.
 *
 * Live-out: SCRIPT_CURSOR (advanced by two on the clear-flag path). Grounding: [seen].
 */
export function skipScriptOperandWhenFlagClear(m) {
  const { mem8 } = m;
  if (mem8[SCRIPT_BRANCH_FLAG] !== 0) return;
  mem8[SCRIPT_CURSOR] = u8(mem8[SCRIPT_CURSOR] + 2);
}
