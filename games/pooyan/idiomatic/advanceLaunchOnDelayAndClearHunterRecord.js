// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { LAUNCH_STATE, PLAY_MODE_LATCH, HUNTER_SPAWN_COUNTDOWN, HUNTER_RECORD_PTR } from "./names.js";
/**
 * advanceLaunchOnDelayAndClearHunterRecord — the post-spawn hold, launch state 3.  [seen]
 *
 * WHAT IT IS
 * ----------
 * ROM 0x28ad. This is state 3 of the launch state machine — the five-state sequence that arms
 * the arrow, animates it, spawns a hunter, holds, and then falls idle. States advance in order:
 * state 2 has just seeded a fresh hunter record and (on the normal, non-flip path) armed a short
 * hold; this handler is the hold. It waits out that delay before letting the sequence continue,
 * and — the delay done — it wipes the scratch hunter record that state 2 stamped, returning the
 * six-slot hunter pool to a clean state for the next launch.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * The launch state selector LAUNCH_STATE (0x8f30) picks one of five handlers each frame by its
 * low three bits; this routine is what runs while the selector reads 3. It is a pure timer-and-
 * cleanup step: nothing here draws, moves an actor, or spawns — it only counts down, bumps the
 * state, and clears a record. When it advances the state to 4 the machine reaches its idle
 * terminal and the launch is complete.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT: memory only. The countdown at HUNTER_SPAWN_COUNTDOWN (0x8f34), the launch selector
 * LAUNCH_STATE (0x8f30), and the 0x18-byte record addressed by HUNTER_RECORD_PTR (0x8f32) are
 * what it leaves behind; the scratch left in working registers is read by no caller.
 */

const RECORD_LEN = 0x18; // bytes cleared in the pointed-to record

export function advanceLaunchOnDelayAndClearHunterRecord(m) {
  const { mem8 } = m;

  // --- The hold countdown (HUNTER_SPAWN_COUNTDOWN, 0x8f34) ---
  // State 2 seeded this cell to 0x20 on the normal spawn path. While it is still non-zero the
  // launch is simply waiting: knock one off the counter and return for this frame, leaving the
  // state selector at 3 so we land right back here next frame. The sequence stalls here — no
  // spawn, no advance — until the delay is fully drained.
  if (mem8[HUNTER_SPAWN_COUNTDOWN] !== 0) {
    mem8[HUNTER_SPAWN_COUNTDOWN] = (mem8[HUNTER_SPAWN_COUNTDOWN] - 1);
    return;
  }

  // --- Delay expired: advance the launch sequence (LAUNCH_STATE, 0x8f30) ---
  // The hold has elapsed. Bump the state selector so next frame the machine moves on to state 4,
  // its idle terminal — the launch is finished and there is nothing left to drive.
  mem8[LAUNCH_STATE] = (mem8[LAUNCH_STATE] + 1);

  // --- Play-mode guard (PLAY_MODE_LATCH, 0x8f50) ---
  // With the play-mode latch set, the alternate update path owns this record and the cleanup is
  // skipped: advance the state but leave the hunter record untouched. Only in the normal mode
  // (latch clear) does this handler tear the record down.
  if (mem8[PLAY_MODE_LATCH] !== 0) return;

  // --- Clear the scratch hunter record (HUNTER_RECORD_PTR, 0x8f32) ---
  // State 2 stashed the address of the hunter slot it just seeded in the little-endian word at
  // HUNTER_RECORD_PTR (0x8f32). Reassemble that pointer and blank the whole 0x18-byte record with
  // zeros (fillByteRun is the machine's memset at restart vector 0x10). This releases the slot
  // back to the six-record hunter pool so the next launch cycle can seed it again.
  const record = mem8[HUNTER_RECORD_PTR] | (mem8[HUNTER_RECORD_PTR + 1] << 8);
  fillByteRun(m, record, 0, RECORD_LEN);
}
