// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMoverMirrored — advance one object-mover step for movement direction 1: step the mover's
 * horizontal position one pixel on the cadence beat and refresh its facing and walk-frame.  ROM 0x347d.
 *
 * One of four fixed-velocity entry points into the shared object-mover body. Each
 * entry hard-wires which axis/sign it steps, a direction index, and whether the walk sprite
 * is refreshed; this entry steps the mover's horizontal position (0x8083 = MOVER_X,
 * screen-horizontal) by one pixel, publishes direction index 1, and does refresh the sprite —
 * always mirrored. The screen sign of that one-pixel step (left vs right) is rotation-ambiguous,
 * so the name stays loc_.
 *
 * Every call ticks the object's per-step cadence counter down. On the ordinary frame
 * it is still counting, nothing else happens. On the frame the counter reaches zero
 * the object takes a step: the counter is reloaded from its period, the direction
 * index is published, and the mover's horizontal position (0x8083) is stepped one pixel —
 * that same stepped value's low bits pick one of four walk-frame sprite codes, and
 * the code is mirrored before it is stored for the draw.
 *
 * The single one-pixel step to 0x8083 both moves the object along its (screen-horizontal)
 * axis and advances the walk animation — the position is NOT left untouched.
 *
 * The name stays neutral: this is one of an as-yet-unnamed four-entry mover family and
 * the physical meaning of "direction 1" (versus the sibling entries) is not pinned, so
 * an English name would claim more than the evidence supports.
 *
 * Memory-equivalent to the frozen oracle — equivalence-347d.test.js.
 * GATE:     crafted-entry near-leaf — never dispatched in attract (a gameplay mover
 *           path; 0 hits over 2500 attract frames), so the gate captures real attract
 *           machine states and pokes the mover inputs identically on both sides: both
 *           counter paths, the full horizontal-position sweep (all four walk
 *           frames + wrap), plus teeth.
 * LIVE-OUT: memory-only — the cadence counter, the reloaded period's landing byte, the
 *           published direction index, the stepped horizontal position (0x8083), and the
 *           stored walk sprite code. The coordinate the oracle leaves behind in a register
 *           is dead ABI; the whole-machine/pixel gate backstops it.
 * NAMES:    ENEMY_ACTION_TIMER (0x808b) is the per-step cadence counter here; ENEMY_WORK_SPRITE (0x8084)
 *           is the stored walk sprite code; ENEMY_WORK_MOVE_PERIOD (0x8091) is the
 *           cadence-reload period; ENEMY_WORK_DIR (0x8092) is the published direction-index cell.
 *           The horizontal position (0x8083 = MOVER_X, screen-horizontal) has no ram.js name yet,
 *           so it stays hex.
 *
 * PURPOSE [guess]: "Mirrored"=0x80 bit; screen sign of the step / "direction 1" rotation-ambiguous. (optional: stepMoverXMirrored to future-proof vs the Y-axis pair.)
 */

import { ENEMY_WORK_SPRITE, ENEMY_ACTION_TIMER, ENEMY_WORK_DIR, ENEMY_WORK_MOVE_PERIOD } from "./ram.js";

// The four walk-frame sprite codes, cycled as the object steps; the stored code is
// always mirrored (high bit set) for this direction.
const WALK_FRAMES = [0x17, 0x14, 0x15, 0x16];

export function stepMoverMirrored(m) {
  const { mem8 } = m;

  // Tick the per-step cadence counter. Most frames it is still counting down, and the
  // object neither steps nor re-animates.
  const cadence = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = cadence;
  if (cadence !== 0) return;

  // Cadence beat: take a step. Reload the counter from its period and publish the
  // direction index this entry represents.
  mem8[ENEMY_ACTION_TIMER] = mem8[ENEMY_WORK_MOVE_PERIOD];
  mem8[ENEMY_WORK_DIR] = 1;

  // Step the mover's horizontal position (0x8083 = MOVER_X, screen-horizontal) one pixel;
  // its low bits choose one of four walk-frame sprite codes, mirrored for the draw.
  mem8[0x8083] = mem8[0x8083] + 1;
  const walkPhase = ((mem8[0x8083] + 4) & 6) >> 1;
  mem8[ENEMY_WORK_SPRITE] = WALK_FRAMES[walkPhase] ^ 0x80;
}
