// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_347d — advance one object-mover step for movement direction 1: no horizontal
 * travel, and on the cadence beat refresh the object's facing and walk-frame.  ROM 0x347d.
 *
 * One of four fixed-velocity entry points into the shared object-mover body. Each
 * entry hard-wires a horizontal step, a direction index, and whether the walk sprite
 * is refreshed; this entry carries a ZERO horizontal step (the object does not move
 * sideways here), direction index 1, and does refresh the sprite — always mirrored.
 *
 * Every call ticks the object's per-step cadence counter down. On the ordinary frame
 * it is still counting, nothing else happens. On the frame the counter reaches zero
 * the object takes a step: the counter is reloaded from its period, the direction
 * index is published, and the walk animation advances one frame — the object's
 * orientation accumulator bumps, that picks one of four walk-frame sprite codes, and
 * the code is mirrored before it is stored for the draw.
 *
 * The horizontal position is left untouched (this direction's step is zero), so this
 * entry only advances the counter and the animation, never the object's location.
 *
 * The name stays neutral: this is one of an as-yet-unnamed four-entry mover family and
 * the physical meaning of "direction 1" (versus the sibling entries) is not pinned, so
 * an English name would claim more than the evidence supports.
 *
 * Memory-equivalent to the frozen oracle — equivalence-347d.test.js.
 * GATE:     crafted-entry near-leaf — never dispatched in attract (a gameplay mover
 *           path; 0 hits over 2500 attract frames), so the gate captures real attract
 *           machine states and pokes the mover inputs identically on both sides: both
 *           counter paths, the full orientation-accumulator sweep (all four walk
 *           frames + wrap), plus teeth.
 * LIVE-OUT: memory-only — the cadence counter, the reloaded period's landing byte, the
 *           published direction index, the orientation accumulator, and the stored walk
 *           sprite code. The accumulator the oracle leaves behind (the object's unchanged
 *           position value) is dead ABI; the whole-machine/pixel gate backstops it.
 * NAMES:    ANIM_RAND (0x808b) is the per-step cadence counter here; ACTOR_STATE (0x8084)
 *           is the stored walk sprite code; MOVER_MOVE_PERIOD (0x8091) is the
 *           cadence-reload period. The orientation accumulator (0x8083) and the
 *           direction-index cell (0x8092) have no ram.js name yet, so they stay hex.
 */

import { ACTOR_STATE, ANIM_RAND, MOVER_DIRECTION, MOVER_MOVE_PERIOD } from "./ram.js";

// The four walk-frame sprite codes, cycled as the object steps; the stored code is
// always mirrored (high bit set) for this direction.
const WALK_FRAMES = [0x17, 0x14, 0x15, 0x16];

export function loc_347d(m) {
  const { mem8 } = m;

  // Tick the per-step cadence counter. Most frames it is still counting down, and the
  // object neither steps nor re-animates (its horizontal step is zero either way).
  const cadence = mem8[ANIM_RAND] - 1;
  mem8[ANIM_RAND] = cadence;
  if (cadence !== 0) return;

  // Cadence beat: take a step. Reload the counter from its period and publish the
  // direction index this entry represents.
  mem8[ANIM_RAND] = mem8[MOVER_MOVE_PERIOD];
  mem8[MOVER_DIRECTION] = 1;

  // Advance the walk animation one frame: bump the orientation accumulator, use it to
  // choose one of four walk-frame sprite codes, and mirror the code for the draw.
  mem8[0x8083] = mem8[0x8083] + 1;
  const walkPhase = ((mem8[0x8083] + 4) & 6) >> 1;
  mem8[ACTOR_STATE] = WALK_FRAMES[walkPhase] ^ 0x80;
}
