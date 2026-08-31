// SPDX-License-Identifier: GPL-3.0-only
import { LAUNCH_STATE } from "./names.js";
import { armLaunchAndAdvanceToHunterSpawn } from "./armLaunchAndAdvanceToHunterSpawn.js";
import { spawnEnemyTargetOrAnimateLaunchFlipTile } from "./spawnEnemyTargetOrAnimateLaunchFlipTile.js";
import { spawnHunterIntoTableAndAdvanceLaunch } from "./spawnHunterIntoTableAndAdvanceLaunch.js";
import { advanceLaunchOnDelayAndClearHunterRecord } from "./advanceLaunchOnDelayAndClearHunterRecord.js";
import { idleLaunchStateNoop } from "./idleLaunchStateNoop.js";

/**
 * dispatchLaunchState — per-frame driver for the arrow/rope launch state machine.
 *
 * WHAT IT IS
 *   ROM 0x2778-0x277d. Grounding: [seen]. A tiny per-frame dispatcher: it reads the launch-state
 *   selector, keeps only its low three bits, and hands control to one of five handlers picked by
 *   that number. Each handler returns straight to this routine's own caller, so the dispatcher is
 *   pure plumbing — it owns no state, and the only memory it touches is the selector it reads.
 *
 * ROLE IN THE MACHINE
 *   Pooyan's "launch" subsystem fires the arrow/rope that carries a hunter (the wolf enemy) into
 *   the play area. The whole firing sequence is a small state machine whose current step lives in a
 *   single byte, LAUNCH_STATE (0x8f30) — a cell that counts 0 -> 1 -> 2 -> 3 -> 4 and wraps back to
 *   0. Other code advances that byte; this routine is the per-frame step executor that turns the
 *   current step number into the right piece of work:
 *     0 -> armLaunchAndAdvanceToHunterSpawn         arm the launch, blit the arrow tile, step on
 *     1 -> spawnEnemyTargetOrAnimateLaunchFlipTile  flap the arrow tile, or seed a target record
 *     2 -> spawnHunterIntoTableAndAdvanceLaunch     drop a hunter into the hunter record table
 *     3 -> advanceLaunchOnDelayAndClearHunterRecord post-spawn hold, then clear the hunter record
 *     4 -> idleLaunchStateNoop                      idle terminal state (does nothing)
 *   All five handlers thread the same gate: the arrow object's height byte ARROW_Y (0x8ab4), the Y
 *   field of the launch actor record, which the earlier states test to decide when to progress.
 *
 * LIVE-OUT
 *   None. This is a void per-frame dispatch — the caller reads nothing back. Whatever memory the
 *   selected handler leaves behind is that handler's contract, not this routine's; here we only
 *   read LAUNCH_STATE (0x8f30) and pass control on.
 */
export function dispatchLaunchState(m) {
  // Read the launch-state selector LAUNCH_STATE (0x8f30) and mask to its low three bits. The state
  // only ever counts 0..4, so three bits (0..7) covers it with room to spare, and the mask also
  // guarantees a stray high bit in the cell can never mis-steer the dispatch. Values 0..4 name a
  // handler below; 5..7 match no case and fall through, returning without acting — a state the
  // machine never parks in during normal play.
  switch (m.mem8[LAUNCH_STATE] & 0x07) {
    // State 0 — arm the launch (once). Raises the launch-armed flag LAUNCH_ARMED_FLAG (0x8f3f) when
    // its preconditions hold — the lane-spawn countdown is up with the arm latch LAUNCH_ARM_LATCH
    // (0x8f20) still clear, or the stage countdown is nonzero and a multiple of eight — then, once
    // the arrow has risen to its gate (ARROW_Y >= 0x3c) with neither hunter-target record showing a
    // hit, steps the state, reseeds the tile-flip countdown, refreshes the arm latch, and blits the
    // launch arrow tile to video RAM.
    case 0: return armLaunchAndAdvanceToHunterSpawn(m);
    // State 1 — animate the arrow or seed a target, forked on the arrow height. While the arrow is
    // still high (ARROW_Y >= 0x34) it runs a flip countdown and, each time it elapses, reseeds it,
    // steps a phase byte, and blits one of two arrow tiles chosen by that byte's parity — the
    // flapping-arrow animation. Once the arrow drops below 0x34 it scans the two hunter-target
    // records for a free one and, finding it, marks the record, seeds three of its fields, queues a
    // display command, and steps the launch state to 2.
    case 1: return spawnEnemyTargetOrAnimateLaunchFlipTile(m);
    // State 2 — seed a hunter into the record table. Unless the play-mode latch is set, it scans the
    // six hunter records at HUNTER_TABLE_BASE (0x8c78) *downward*, one 0x18-byte stride apart, for
    // the first free slot, stamps it with the fixed opening state/coords/tile ids, and records that
    // slot's address in HUNTER_RECORD_PTR (0x8f32). Either way it advances the launch state and,
    // on the non-flip path, seeds the post-spawn countdown HUNTER_SPAWN_COUNTDOWN (0x8f34) to 0x20
    // and enqueues a display command (on the flip path it bumps a sub-counter instead).
    case 2: return spawnHunterIntoTableAndAdvanceLaunch(m);
    // State 3 — post-spawn hold. Drains the spawn countdown HUNTER_SPAWN_COUNTDOWN (0x8f34) one per
    // frame; while it is still running the routine just returns. On expiry it advances the launch
    // state to the idle terminal and (unless the play-mode latch is set) clears the 0x18-byte hunter
    // record pointed to by HUNTER_RECORD_PTR (0x8f32), retiring the just-spawned launch slot.
    case 3: return advanceLaunchOnDelayAndClearHunterRecord(m);
    // State 4 — idle terminal. A bare no-op: the launch has completed and the machine rests here,
    // doing nothing each frame, until other code re-arms it by resetting LAUNCH_STATE back to 0.
    case 4: return idleLaunchStateNoop(m);
  }
}
