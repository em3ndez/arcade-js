// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { fillByteRun } from "./fillByteRun.js";
import {
  SPAWN_PHASE_COUNTER,
  ROPE_DRAW_COUNT,
  FORMATION_SLOT_TABLE,
  TAMPER_OBJECT_FREEZE_FLAG,
  ANIM_SCRIPT_CURSOR,
  SECONDARY_TEARDOWN_FLAG,
  FORMATION_SPAWN_TIMER,
  LEAD_ACTOR_STATE,
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  HIT_TALLY,
  ANIM_ARMED_LATCH,
} from "./names.js";
/**
 * resetBoardRamAndReseedSpawnCounters — board / HUD reset. ROM 0x2527. Grounding: [seen].
 *
 * WHAT IT IS: the routine the per-round state machine runs to wipe a round's transient working
 * state back to a clean slate — and, once the round's phase counter has completed its full cycle,
 * to reseed the spawn machinery so the next pass starts fresh. It touches three families of RAM:
 * the two spawn-phase counters (reseeded only on the wrap), several transient RAM blocks that are
 * always blanked, and five individual actor/HUD cells that are mirrored to the same value.
 *
 * ROLE IN THE MACHINE: this is the reset step of the phase-gauge round handler
 * (advancePhaseGaugeCountdown). Each time the visible phase gauge is serviced, the board's
 * per-round scratch state is cleared here so stale enemy/animation state from the previous phase
 * cannot leak into the next one; when the phase counter has run all the way to its cap the same
 * pass also rolls the spawn counters over to begin a new spawn cycle.
 *
 * THE FILL VALUE: everything this routine blanks is written with a single value. That value is 0
 * on the ordinary path; only on the reseed (phase-wrap) branch is it instead taken from the
 * anti-tamper object-freeze flag (0x89fb), which is broadcast into the cleared cells. So in normal
 * play the routine zeroes every block and cell below.
 *
 * LIVE-OUT: A = the fill value (0, or the object-freeze flag on the reseed branch). The final
 * RAM-block fill also leaves HL pointing just past the last byte it wrote and B = 0 (the drained
 * fill counter), both readable by whatever runs next.
 */

const RESET_CMD_HI = 0x08; //     display-command class byte enqueued at entry
const PHASE_CAP = 0x07; //        spawn-phase value at/above which the reseed branch runs
const PHASE_RESEED = 0x04; //     value reseeded into the phase + rope-draw counters
const FORMATION_SLOTS_LEN = 0x20; // bytes filled at the formation slot table (reseed branch)
const ANIM_CURSOR_LEN = 0x4f; //  bytes filled at the animation-script cursor block
const TEARDOWN_LEN = 0x04; //     bytes filled at the secondary-teardown block
const SPAWN_TIMER_LEN = 0x03; //  bytes filled at the formation-spawn-timer block

export function resetBoardRamAndReseedSpawnCounters(m, cmdLow = m.regs.e) {
  const { mem8 } = m;

  // Announce the reset to the display/sound consumer: enqueue one command of class 0x08
  // (RESET_CMD_HI) whose argument low byte is supplied by the caller. The command is appended to
  // the page-0x88 display-command ring and acted on later when that ring is drained.
  enqueueDisplayCommand(m, (RESET_CMD_HI << 8) | (cmdLow & 0xff));

  // Decide the fill value and whether the spawn cycle rolls over. SPAWN_PHASE_COUNTER (0x8902) is
  // the per-round phase counter that cycles 0..7 selecting the spawn/fire mode branches. It starts
  // at 0 (a plain clear, fill = 0); once it has reached its cap (0x07) the round has completed its
  // phase cycle, so this pass reseeds the counters and takes its fill value from the anti-tamper
  // object-freeze flag (0x89fb) instead of 0.
  let fill = 0;
  if (mem8[SPAWN_PHASE_COUNTER] >= PHASE_CAP) {
    // Reseed branch. Capture the object-freeze flag as the broadcast fill value, roll the phase
    // counter and its one-frame mirror ROPE_DRAW_COUNT (0x8934, the rope/lift segment draw count)
    // back to 0x04 to restart the spawn cycle, and blank the 0x20-byte enemy-formation slot table
    // (FORMATION_SLOT_TABLE, 0x8920) so no launch slots survive into the new cycle.
    fill = mem8[TAMPER_OBJECT_FREEZE_FLAG];
    mem8[SPAWN_PHASE_COUNTER] = PHASE_RESEED;
    mem8[ROPE_DRAW_COUNT] = PHASE_RESEED;
    fillByteRun(m, FORMATION_SLOT_TABLE, fill, FORMATION_SLOTS_LEN);
  }

  // Always-cleared transient RAM blocks. These hold per-round scratch state that must not carry
  // over, so they are blanked to the fill value on every reset pass:
  //   - ANIM_SCRIPT_CURSOR (0x8f00), 0x4f bytes: the animation/formation state region based at the
  //     shared per-actor animation-script cursor, resetting all in-flight actor animation scripts.
  //   - SECONDARY_TEARDOWN_FLAG (0x8f57), 4 bytes: the teardown-flag block that gates/aborts the
  //     player-object update.
  //   - FORMATION_SPAWN_TIMER (0x8d30), 3 bytes: the formation-spawn countdown and its adjacent
  //     rope-grab latch.
  fillByteRun(m, ANIM_SCRIPT_CURSOR, fill, ANIM_CURSOR_LEN);
  fillByteRun(m, SECONDARY_TEARDOWN_FLAG, fill, TEARDOWN_LEN);
  fillByteRun(m, FORMATION_SPAWN_TIMER, fill, SPAWN_TIMER_LEN);

  // Mirror the same fill value into five individual actor/HUD cells that live outside the blocks
  // above but must reset in lock-step with them:
  //   - LEAD_ACTOR_STATE (0x8a82): lead-actor (slot 0) state/phase index driving the 6-way dispatch.
  //   - ENEMY_TARGET_REC0 / ENEMY_TARGET_REC1 (0x8c90 / 0x8ca8): the two I-parity enemy/target
  //     actor records, whose low bits carry presence/state.
  //   - HIT_TALLY (0x8f52): the running per-round tally of target hits.
  //   - ANIM_ARMED_LATCH (0x8f63): the one-shot latch marking that the interior/rope sprite band
  //     has been built.
  mem8[LEAD_ACTOR_STATE] = fill;
  mem8[ENEMY_TARGET_REC0] = fill;
  mem8[ENEMY_TARGET_REC1] = fill;
  mem8[HIT_TALLY] = fill;
  mem8[ANIM_ARMED_LATCH] = fill;

  return (m.regs.a = fill); // A live-out: the value mirrored into the cells above
}
