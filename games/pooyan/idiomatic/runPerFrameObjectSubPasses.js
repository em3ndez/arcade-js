// SPDX-License-Identifier: GPL-3.0-only
import { spawnPairedEnemyOnDelaySweep } from "./spawnPairedEnemyOnDelaySweep.js";
import { stepPairedDescendingObjects } from "./stepPairedDescendingObjects.js";
import { spawnEnemyOnBlinkCountdownSweep } from "./spawnEnemyOnBlinkCountdownSweep.js";
import { runObjectsElseVerifyTilemapChecksum } from "./runObjectsElseVerifyTilemapChecksum.js";
/**
 * runPerFrameObjectSubPasses — per-frame object group update.
 *
 * WHAT IT IS: a tiny sequencer that fires four object sub-passes back-to-back, in a fixed order,
 * once per frame. It owns no logic of its own — it is the ordering contract for the object
 * subsystem, and that ORDER is the whole point: allocate first, then step, then allocate again on a
 * different gate, then run the main per-object driver. Each sub-pass reads and writes the shared
 * object state in work RAM; nothing is handed between them in registers, only through memory.
 *
 * ROLE IN THE MACHINE: this is one arm of the per-frame object driver. Its caller
 * (driveObjectsByFrameParityThenBuildSprites) picks between two group updates by the low bit of the
 * round counter (ROUND_COUNTER 0x8907): when that bit is set it runs THIS group update, otherwise
 * the spawn-subtree pass; either way the caller then rebuilds the sprite display list for the frame.
 * So this routine is the "objects move and appear this frame" step for the odd-round variant, run
 * just before the screen's sprites are re-staged.
 *
 * ROM address: 0x68f8 (0x68f8-0x6904).
 * Grounding: [seen].
 *
 * The four passes, in the exact order they must run:
 *   1. spawnPairedEnemyOnDelaySweep      (0x6905) — delay-gated paired enemy allocator
 *   2. stepPairedDescendingObjects       (0x69ad) — advance the eight descending-object records
 *   3. spawnEnemyOnBlinkCountdownSweep   (0x6a0f) — blink-gated flat-pool enemy allocator
 *   4. runObjectsElseVerifyTilemapChecksum (0x6a7f) — the main per-object driver / tilemap guard
 *
 * LIVE-OUT: none — a void sequencer. No register survives and the caller reads nothing back; every
 * effect of the frame lands in the object records and timer cells that the four sub-passes touch.
 */
export function runPerFrameObjectSubPasses(m) {
  // Pass 1 — the delay-gated PAIRED enemy allocator (0x6905). It first ticks the shared frame-delay
  // timer (SHARED_FRAME_DELAY_TIMER 0x8929); only once that timer is clear, and the current wave is
  // neither full nor at its limit, does it walk the eight enemy/state record pairs and bring one new
  // enemy to life in the first empty pair. At most one enemy is born per call — the throttle that
  // makes enemies trickle in rather than flood. Running this first means any slot it claims is
  // already live before the stepping and driving passes below sweep the pool.
  spawnPairedEnemyOnDelaySweep(m);

  // Pass 2 — advance the eight paired descending-object records (0x69ad). Each of the eight records
  // is handed to the per-record stepper (advancePairedDescendingObjectStep), which moves that object
  // one step down its descent this frame. This is the motion pass for the falling/descending object
  // group; it runs after allocation so a slot claimed this frame is stepped in the same frame.
  stepPairedDescendingObjects(m);

  // Pass 3 — the SECOND enemy allocator, gated differently (0x6a0f). Where pass 1 gates on the
  // frame-delay timer and works the eight paired records, this one gates on the blink phase
  // (BLINK_PHASE 0x892b) and its own cadence countdown (BLINK_COUNTDOWN 0x892a), then sweeps the
  // flat 18-record enemy pool (ENEMY_ACTOR_TABLE 0x8ae0, stride 0x18) and spawns into the first
  // empty slot — again at most one per frame, aborting the sweep on that spawn. Two allocators on
  // two independent gates feed the arena from different cadences within the one frame.
  spawnEnemyOnBlinkCountdownSweep(m);

  // Pass 4 — the main per-object driver, with a one-shot integrity guard baked in (0x6a7f). When the
  // blink phase (BLINK_PHASE 0x892b) is set it runs the descending-object state machine
  // (dispatchDescendingObjectState) over the 18 enemy-actor records (0x8ae0, stride 0x18), advancing
  // each live object's state for the frame. Otherwise — specifically when the wave index
  // (WAVE_NUMBER 0x892d) is 2 and the once-per-pass latch (TILE_SUM_ONCE_LATCH 0x8f56) is still
  // clear — it takes the alternate branch: it checksums the playfield tilemap starting at 0x8450
  // (skipping column 0x1b, advancing a row at +0x12, stopping once the high byte reaches 0x88) and
  // demands the sum equal 0x29b8, throwing a tamper trap on any mismatch. Running last, it drives
  // whatever the two allocators and the stepper left in the pool for this frame.
  runObjectsElseVerifyTilemapChecksum(m);
}
