// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMoverDown — one fixed-direction preset of the patrol mover: step its position one unit
 * forward each frame and, on the cadence tick, re-arm the cadence and publish its facing index.
 * The mover has four presets sharing one body, each hard-wiring a direction as a position delta
 * plus a facing index. This preset carries a +1 step and facing index 2 with no cross-axis motion:
 * it ticks the cadence countdown (ENEMY_ACTION_TIMER), and the frame it runs out reloads from
 * ENEMY_WORK_MOVE_PERIOD and publishes facing index 2 into ENEMY_WORK_DIR; ENEMY_WORK_Y advances
 * every frame. Sibling presets with a cross-axis step also rewrite a sprite code on the tick,
 * work absent here.
 */

import { ENEMY_ACTION_TIMER, ENEMY_WORK_DIR, ENEMY_WORK_MOVE_PERIOD, ENEMY_WORK_Y } from "./names.js";

export function stepMoverDown(m) {
  const { mem8 } = m;

  // Tick the cadence countdown down one, every frame.
  const countdown = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = countdown;

  // The frame it runs out, re-arm the cadence and publish this preset's facing index.
  if (countdown === 0) {
    mem8[ENEMY_ACTION_TIMER] = mem8[ENEMY_WORK_MOVE_PERIOD];
    mem8[ENEMY_WORK_DIR] = 2;
  }

  // Advance the mover one unit forward along its axis, every frame.
  mem8[ENEMY_WORK_Y] = mem8[ENEMY_WORK_Y] + 1;
}
