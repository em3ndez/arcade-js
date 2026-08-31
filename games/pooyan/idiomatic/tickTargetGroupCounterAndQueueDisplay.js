// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
/**
 * tickTargetGroupCounterAndQueueDisplay — one tick of the phase-5 target-group step.
 *
 * WHAT IT IS: a tiny per-call helper living at ROM 0x7059. When a round runs its target-group
 * phase (play sub-state 5), the group of "targets" the player must clear is counted down one at
 * a time; each tick this routine does exactly two things — drop that counter by one, and drop a
 * single fixed command word into the display-command ring so the on-screen presentation keeps
 * pace with the count. It touches no other state and hands the pointer back untouched, so a
 * caller can tick the same counter again and again without reloading it.
 *
 * ITS ROLE IN THE MACHINE: the counter it decrements is addressed by HL on entry; the phase-5
 * caller points HL at TARGET_GROUP_COUNT (0x8f47) — the number of targets in the current group,
 * the same value scaled x5 into the HUD and later compared against the hit tally for the
 * end-level bonus. Draining it is how the phase measures its own progress toward completion.
 * The command word queued alongside is HUNTER_SPAWN_DISPLAY_CMD (0x0315): the high byte 0x03 is
 * the command class, the low byte 0x15 its argument. The routine never interprets the word — it
 * just posts it to the ring, where the frame's display consumer later drains and acts on it.
 *
 * ROM ADDRESS: 0x7059 (0x7059-0x705e).
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT (what it leaves behind):
 *   - the counter HL points at (TARGET_GROUP_COUNT when phase 5 calls it) is one lower;
 *   - one HUNTER_SPAWN_DISPLAY_CMD word is appended to the display-command ring (page 0x88),
 *     unless the ring's target slot is still busy, in which case the enqueue silently drops it;
 *   - HL is returned unchanged (the counter pointer), and DE holds the command word;
 *   - A is scratched by the enqueue's ring-slot test.
 */
const TARGET_TICK_DISPLAY_CMD = (0x03 << 8) | 0x15; // HUNTER_SPAWN_DISPLAY_CMD (0x0315): class 0x03, arg 0x15

export function tickTargetGroupCounterAndQueueDisplay(m, at = m.regs.hl) {
  const { mem8 } = m;

  // Step 1 — drop the target-group counter by one. HL (`at`) addresses the counter; phase 5
  // points it at TARGET_GROUP_COUNT (0x8f47), the remaining-targets tally for the current group.
  // This single decrement is the phase's progress heartbeat toward clearing the group.
  mem8[at] = mem8[at] - 1;

  // Step 2 — post the paired presentation command. HUNTER_SPAWN_DISPLAY_CMD (0x0315) goes into
  // the page-0x88 display-command ring so the frame's display consumer can react to this tick;
  // if the ring's write slot is still holding an undrained command the word is dropped, exactly
  // as the hardware does when the buffer is full.
  enqueueDisplayCommand(m, TARGET_TICK_DISPLAY_CMD);

  // Step 3 — hand back the counter pointer (HL, unchanged) and the command word (DE), the two
  // values the caller expects to find after the tick, leaving it free to tick again.
  return [(m.regs.hl = at), (m.regs.de = TARGET_TICK_DISPLAY_CMD)];
}
