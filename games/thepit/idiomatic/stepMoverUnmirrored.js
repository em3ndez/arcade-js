// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMoverUnmirrored — advance one object-mover step for movement direction 3: step the mover's
 * horizontal position one pixel on the cadence beat and refresh its facing and walk-frame.  ROM 0x348b.
 *
 * One of four fixed-velocity entry points into the shared object-mover body. Each
 * entry hard-wires which axis/sign it steps, a direction index, and whether the walk sprite
 * is refreshed; this entry steps the mover's horizontal position (ENEMY_WORK_X 0x8083,
 * screen-horizontal) by one pixel, publishes direction index 3, and does refresh the sprite —
 * always UN-mirrored (the opposite of the sibling that steps the same axis the other way).
 * The screen sign of that one-pixel step (left vs right) is rotation-ambiguous, so the name stays loc_.
 *
 * Every call ticks the object's per-step cadence counter down. On the ordinary frame
 * it is still counting, nothing else happens. On the frame the counter reaches zero
 * the object takes a step: the counter is reloaded from its period, the direction
 * index is published, and the mover's horizontal position (0x8083) is stepped one pixel —
 * that same stepped value's low bits pick one of four walk-frame sprite codes, and the
 * code is stored for the draw without the horizontal flip.
 *
 * The single one-pixel step to 0x8083 both moves the object along its (screen-horizontal)
 * axis and advances the walk animation — the position is NOT left untouched.
 *
 * The name stays neutral: this is one of an as-yet-unnamed four-entry mover family
 * (its siblings likewise kept loc_ names) and the physical meaning of "direction 3"
 * versus the others is not pinned to a screen axis, so an English name would claim
 * more than the evidence supports.
 *
 * Memory-equivalent to the frozen oracle — equivalence-348b.test.js.
 * GATE:     RAM-only; real captured attract dispatches (reached ~1150×/3000 frames,
 *           spanning both the still-counting and the cadence-reload branch) + a crafted
 *           counter/orientation sweep that forces the reload branch across every
 *           accumulator value + teeth. A near-leaf: its result is a pure function of
 *           the counter, reload-period, and orientation bytes — it reads no register
 *           input (it overwrites its own velocity/direction on entry) and calls nothing.
 * LIVE-OUT: memory-only — the cadence counter, the reloaded period's landing byte, the
 *           published direction index, the stepped horizontal position (0x8083), and the
 *           stored walk sprite code. The coordinate the oracle leaves behind in a register
 *           is dead ABI; the whole-machine/pixel gate backstops it.
 * NAMES:    ENEMY_ACTION_TIMER (0x808b) is the per-step cadence counter here; ENEMY_WORK_SPRITE (0x8084)
 *           is the stored walk sprite code; ENEMY_WORK_MOVE_PERIOD (0x8091) is the
 *           cadence-reload period; ENEMY_WORK_DIR (0x8092) is the published direction-index cell.
 *           The horizontal position is ENEMY_WORK_X (0x8083, screen-horizontal).
 *
 * PURPOSE [guess]: "Unmirrored"=0x80 clear; "direction 3"; rotation-ambiguous.
 */

import { ENEMY_WORK_SPRITE, ENEMY_ACTION_TIMER, ENEMY_WORK_DIR, ENEMY_WORK_MOVE_PERIOD, ENEMY_WORK_X } from "./names.js";

// The four walk-frame sprite codes, cycled as the object steps; this direction stores
// the code un-mirrored (no high-bit flip).
const WALK_FRAMES = [0x17, 0x14, 0x15, 0x16];

export function stepMoverUnmirrored(m) {
  const { mem8 } = m;

  // Tick the per-step cadence counter. Most frames it is still counting down, and the
  // object neither steps nor re-animates.
  const cadence = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = cadence;
  if (cadence !== 0) return;

  // Cadence beat: take a step. Reload the counter from its period and publish the
  // direction index this entry represents.
  mem8[ENEMY_ACTION_TIMER] = mem8[ENEMY_WORK_MOVE_PERIOD];
  mem8[ENEMY_WORK_DIR] = 3;

  // Step the mover's horizontal position (ENEMY_WORK_X 0x8083, screen-horizontal) one pixel;
  // its low bits choose one of four walk-frame sprite codes, stored un-mirrored.
  mem8[ENEMY_WORK_X] = mem8[ENEMY_WORK_X] - 1;
  const walkPhase = ((mem8[ENEMY_WORK_X] + 4) & 6) >> 1;
  mem8[ENEMY_WORK_SPRITE] = WALK_FRAMES[walkPhase];
}
