// SPDX-License-Identifier: GPL-3.0-only
import { ENEMY_ANIM_DELTA, ENEMY_ANIM_ACCUM, SCRIPT_BRANCH_FLAG } from "./names.js";

/**
 * setFlagFromPhaseAccumulatorSign — a script "phase-probe" opcode that sets the branch flag from an
 * animation-phase sign test. ROM 0x9c3b.
 *
 * Role in the machine: enemy animation and script sequencing are driven by a tiny byte-code interpreter
 * whose conditional opcodes each leave a verdict in the shared branch flag (SCRIPT_BRANCH_FLAG, loc_10c)
 * that the interpreter then tests. This opcode probes an animation phase accumulator: it forms a stepped
 * phase value from the per-object delta and its accumulator and reports whether that value's high bit —
 * its sign — carries against the accumulator, so the script can branch on the phase having gone negative.
 *
 * Behavior: compute a = (ENEMY_ANIM_DELTA << 2) & 0xff (loc_147 scaled by 4), add the accumulator
 * ENEMY_ANIM_ACCUM (loc_148) mod 256, then AND the sum with the accumulator and 0x80 to isolate the
 * common sign bit, and XOR with 0x80 to invert it. The stored flag is therefore 0x00 when that high bit
 * is set (both negative) and 0x80 when it is clear. All arithmetic wraps to a byte.
 *
 * Live-out: SCRIPT_BRANCH_FLAG (loc_10c) — 0x00 or 0x80. No registers.
 *
 * Grounding: [seen]
 */
export function setFlagFromPhaseAccumulatorSign(m) {
  const { mem8 } = m;
  // Step the phase: delta * 4 (byte-wrapped).
  let a = (mem8[ENEMY_ANIM_DELTA] << 2) & 0xff;
  // Add the running phase accumulator.
  a = (a + mem8[ENEMY_ANIM_ACCUM]) & 0xff;
  // Isolate the shared sign bit against the accumulator, then invert it.
  a = (a & mem8[ENEMY_ANIM_ACCUM] & 0x80) ^ 0x80;
  mem8[SCRIPT_BRANCH_FLAG] = a;
}
