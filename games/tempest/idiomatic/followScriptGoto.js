// SPDX-License-Identifier: GPL-3.0-only
import { SCRIPT_CURSOR, MOTION_SCRIPT_GOTO } from "./names.js";
import { u16 } from "../../../core/int.js";

/**
 * followScriptGoto -- the unconditional-goto opcode of the object motion script. ROM 0x9c17.
 *
 * Role in the machine: Tempest's enemies (flippers, spikers, and the like) are animated by a tiny
 * byte-code motion script. A rolling cursor, SCRIPT_CURSOR ($010b), names the current instruction; a
 * parallel table at MOTION_SCRIPT_GOTO ($a0f8) holds each slot's goto target. This opcode is the
 * unconditional jump: it retargets the cursor so the script continues from a new position, which is how a
 * pattern loops or chains into its next phase. It is the delegate the dwell opcode
 * (holdSlotPoseUntilTimerExpires) calls each frame to keep an object cycling its current state.
 *
 * Behavior: read the current cursor from SCRIPT_CURSOR, use it to index MOTION_SCRIPT_GOTO, and write that
 * fetched byte back as the new cursor. One table lookup, one store -- no branch, no timer. The next script
 * step will read from wherever the goto pointed.
 *
 * Live-out: SCRIPT_CURSOR ($010b) is overwritten with the goto target byte.
 *
 * Grounding: [seen].
 */
export function followScriptGoto(m) {
  const { mem8 } = m;
  // Current script position...
  const index = mem8[SCRIPT_CURSOR];
  // ...index the goto table and write its target back as the new cursor.
  mem8[SCRIPT_CURSOR] = mem8[u16(MOTION_SCRIPT_GOTO + index)];
}
