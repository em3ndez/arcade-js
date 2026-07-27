// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_348b — advance one object-mover step for movement direction 3: no horizontal
 * travel, and on the cadence beat refresh the object's facing and walk-frame.  ROM 0x348b.
 *
 * One of four fixed-velocity entry points into the shared object-mover body. Each
 * entry hard-wires a horizontal step, a direction index, and whether the walk sprite
 * is refreshed; this entry carries a ZERO horizontal step (the object does not move
 * sideways here), direction index 3, and does refresh the sprite — always UN-mirrored
 * (the opposite of the sibling that steps the same axis the other way).
 *
 * Every call ticks the object's per-step cadence counter down. On the ordinary frame
 * it is still counting, nothing else happens. On the frame the counter reaches zero
 * the object takes a step: the counter is reloaded from its period, the direction
 * index is published, and the walk animation advances one frame — the object's
 * orientation accumulator steps backward, that picks one of four walk-frame sprite
 * codes, and the code is stored for the draw without the horizontal flip.
 *
 * The horizontal position is left untouched (this direction's step is zero), so this
 * entry only advances the counter and the animation, never the object's location.
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
 *           published direction index, the orientation accumulator, and the stored walk
 *           sprite code. The accumulator the oracle leaves behind (the object's unchanged
 *           position value) is dead ABI; the whole-machine/pixel gate backstops it.
 * NAMES:    ANIM_RAND (0x808b) is the per-step cadence counter here; ACTOR_STATE (0x8084)
 *           is the stored walk sprite code. The orientation accumulator (0x8083), the
 *           cadence-reload period (0x8091) and the direction-index cell (0x8092) have no
 *           ram.js name yet, so they stay hex.
 */

import { ACTOR_STATE, ANIM_RAND, MOVER_DIRECTION } from "./ram.js";

// The four walk-frame sprite codes, cycled as the object steps; this direction stores
// the code un-mirrored (no high-bit flip).
const WALK_FRAMES = [0x17, 0x14, 0x15, 0x16];

export function loc_348b(m) {
  const { mem8 } = m;

  // Tick the per-step cadence counter. Most frames it is still counting down, and the
  // object neither steps nor re-animates (its horizontal step is zero either way).
  const cadence = mem8[ANIM_RAND] - 1;
  mem8[ANIM_RAND] = cadence;
  if (cadence !== 0) return;

  // Cadence beat: take a step. Reload the counter from its period and publish the
  // direction index this entry represents.
  mem8[ANIM_RAND] = mem8[0x8091];
  mem8[MOVER_DIRECTION] = 3;

  // Advance the walk animation one frame: step the orientation accumulator backward,
  // use it to choose one of four walk-frame sprite codes, and store the code un-mirrored.
  mem8[0x8083] = mem8[0x8083] - 1;
  const walkPhase = ((mem8[0x8083] + 4) & 6) >> 1;
  mem8[ACTOR_STATE] = WALK_FRAMES[walkPhase];
}
