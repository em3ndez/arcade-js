// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_298, SCRIPT_CURSOR } from "./names.js";
import { followScriptGoto } from "./followScriptGoto.js";

/**
 * holdSlotPoseUntilTimerExpires -- the "dwell" opcode of the object animation scripts. ROM 0x9c0c.
 *
 * Role in the machine: Tempest's on-screen objects (enemies, the shot, explosions) are animated by a
 * tiny per-slot bytecode. Each script instruction can hold the object in its current pose for a number
 * of frames before the cursor is allowed to advance. This is that hold instruction: it makes the acting
 * slot linger on the state it is already in until a countdown expires, then releases the script to the
 * next step.
 *
 * Behavior: the acting slot's per-slot dwell timer lives in the table loc_298 indexed by X. Decrement it
 * in place. While it is still nonzero the object must keep cycling its current state, so delegate to the
 * loc_a0f8-driven goto (followScriptGoto), which re-runs the current instruction, and return without
 * touching the cursor. Only when the timer reaches zero does the dwell end -- bump the shared script
 * cursor loc_10b so the interpreter moves on to the next instruction on the following pass.
 *
 * Live-out: the decremented timer loc_298,X; and, on expiry, the advanced shared script cursor loc_10b.
 * Grounding: [seen].
 */
export function holdSlotPoseUntilTimerExpires(m, x = m.regs.x) {
  const { mem8 } = m;
  const e = u16(loc_298 + x);      // this slot's dwell timer
  mem8[e]--;                       // count down one frame
  if (mem8[e] !== 0) {
    // Still dwelling: re-run the current script state, leave the cursor put.
    followScriptGoto(m);
    return;
  }
  mem8[SCRIPT_CURSOR]++;           // timer expired: release the script to the next instruction
}
