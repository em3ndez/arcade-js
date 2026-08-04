// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMoverDown — one fixed-direction preset of the patrol mover: step its position one
 * unit forward each frame and, on the cadence tick, re-arm the cadence and publish
 * this preset's facing index.  ROM 0x3484.
 *
 * The mover has four preset entry points that share one body, each hard-wiring a
 * direction as a position delta plus a facing index. This preset carries a +1
 * position step and facing index 2, with no cross-axis motion. Each frame it does:
 *   - Tick the cadence countdown down by one.
 *   - The frame the countdown runs out, reload it from its reload value and publish
 *     this preset's facing index (2) as the mover's current direction.
 *   - Advance the mover one unit forward along its axis — every frame, regardless of
 *     the countdown.
 * The sibling presets that carry a cross-axis step also rewrite an orientation/sprite
 * code on the cadence tick; this preset never does (its cross-axis delta is zero), so
 * that work is simply absent from the live path here.
 *
 * Entered by tail-jump from the mover dispatch (stepEnemyMover); it leaves all of its work
 * in memory and returns to the dispatcher's caller, which copies the mover's record
 * out of memory without reading any register this routine leaves behind.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3484.test.js.
 * GATE:     RAM-only; real captured attract dispatches (reached ~250×/3000 frames,
 *           spanning both the tick-only and the cadence-reload branch) + a crafted
 *           countdown sweep that forces the reload branch and its boundary + teeth.
 *           A leaf: its result is a pure function of the countdown, reload, and
 *           position bytes — it reads no register input and calls nothing.
 * LIVE-OUT: memory-only — the cadence countdown, the published facing index, and the
 *           advanced position. The oracle's residual value registers/flags are dead
 *           ABI: the caller overwrites the registers and reads the mover's record from
 *           memory, so none is consumed. The RAM gate backstops that.
 * NAMES:    ENEMY_ACTION_TIMER (0x808b) serves as this mover's cadence countdown here; the
 *           reload ENEMY_WORK_MOVE_PERIOD (0x8091). The facing byte is ENEMY_WORK_DIR (0x8092);
 *           the position byte is ENEMY_WORK_Y (0x8086). The name stays neutral loc_: the effect
 *           (advance the mover, publish its facing) is clear, but the screen direction
 *           this preset encodes is not pinned to an axis, and that direction is the
 *           only thing that would distinguish an English name from its siblings.
 */

import { ENEMY_ACTION_TIMER, ENEMY_WORK_DIR, ENEMY_WORK_MOVE_PERIOD, ENEMY_WORK_Y } from "./names.js";

export function stepMoverDown(m) {
  const { mem8 } = m;

  // Tick the cadence countdown down one, every frame.
  const countdown = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = countdown;

  // The frame it runs out, re-arm the cadence from its reload value and publish this
  // preset's facing index as the mover's current direction.
  if (countdown === 0) {
    mem8[ENEMY_ACTION_TIMER] = mem8[ENEMY_WORK_MOVE_PERIOD];
    mem8[ENEMY_WORK_DIR] = 2;
  }

  // Advance the mover one unit forward along its axis, every frame.
  mem8[ENEMY_WORK_Y] = mem8[ENEMY_WORK_Y] + 1;
}
