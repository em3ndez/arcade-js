// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMoverUnmirrored — advance one object-mover step for movement direction 3: on the cadence
 * beat, step the mover's horizontal position one pixel and refresh its facing and walk-frame.
 * One of four fixed-velocity entries into the shared object-mover body, each hard-wiring an
 * axis/sign, a direction index, and whether the walk sprite is refreshed. Every call ticks
 * ENEMY_ACTION_TIMER down and does nothing until it reaches zero; on that beat it reloads from
 * ENEMY_WORK_MOVE_PERIOD, publishes direction index 3 in ENEMY_WORK_DIR, and steps ENEMY_WORK_X
 * one pixel, whose low bits pick one of four walk-frame codes stored un-mirrored (no high-bit
 * flip) in ENEMY_WORK_SPRITE. The screen sign of the step is rotation-ambiguous; the name stays neutral.
 */

import { ENEMY_WORK_SPRITE, ENEMY_ACTION_TIMER, ENEMY_WORK_DIR, ENEMY_WORK_MOVE_PERIOD, ENEMY_WORK_X } from "./names.js";

// The four walk-frame sprite codes; this direction stores the code un-mirrored.
const WALK_FRAMES = [0x17, 0x14, 0x15, 0x16];

export function stepMoverUnmirrored(m) {
  const { mem8 } = m;

  // Tick the per-step cadence counter; most frames it is still counting down.
  const cadence = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = cadence;
  if (cadence !== 0) return;

  // Cadence beat: reload the counter from its period and publish the direction index.
  mem8[ENEMY_ACTION_TIMER] = mem8[ENEMY_WORK_MOVE_PERIOD];
  mem8[ENEMY_WORK_DIR] = 3;

  // Step ENEMY_WORK_X one pixel; its low bits choose a walk-frame code, stored un-mirrored.
  mem8[ENEMY_WORK_X] = mem8[ENEMY_WORK_X] - 1;
  const walkPhase = ((mem8[ENEMY_WORK_X] + 4) & 6) >> 1;
  mem8[ENEMY_WORK_SPRITE] = WALK_FRAMES[walkPhase];
}
