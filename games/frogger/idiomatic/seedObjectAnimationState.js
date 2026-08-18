// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedObjectAnimationState  —  ROM 0x1a02  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The one-time animation-state seeder for a board's moving lane objects (the logs, cars, turtles and
 *   friends that scroll across each lane). Frogger keeps each object's animation counter in a table in
 *   work RAM; this routine stamps that table's starting values at the top of every board so the objects
 *   begin their cycles at staggered phases instead of all animating in lockstep. It copies two fixed
 *   value tables into two blocks of the object table — cell i of a block takes seed i.
 *
 * WHERE IT SITS
 *   Board init only — never a per-frame path. It is the tail of renderFrogAndArmObjects (ROM 0x1952),
 *   the board-start composite render that paints the goal-bay furniture and raises the three object-ready
 *   flags OBJECT_READY_0/1/2 (0x8007/0x8009/0x800b) before handing off here. It is also reached from
 *   advanceBoardForeground when a board is completed, to re-seed the next (harder) board's objects. Once
 *   these cells are laid down, the per-frame animation arms take over and advance them.
 *
 * LIVE-OUT
 *   Memory only — the seeded object-animation cells in the two blocks below. It returns nothing and
 *   leaves no register the caller reads.
 */
import { OBJECT_ANIM_STATE_8021, OBJECT_ANIM_STATE_800D } from "./names.js";

// The object records sit two bytes apart in each block, so a write steps by this stride to land on
// successive objects' animation cell (the interleaved byte between them is left untouched here). This
// is the ROM's stride-2 walk over the object table.
const OBJECT_STRIDE = 2;

// Seed table for the object-animation CELL block (OBJECT_ANIM_STATE_8021, below). Fourteen entries — one
// per object — copied in order. Adjacent equal pairs (6,6 / 5,5 / 4,4 / 7,7 …) hand paired objects the
// same starting phase; the run as a whole gives the lane objects distinct initial counters so their
// animations don't all tick together.
const ANIM_CELL_SEEDS = [6, 6, 5, 5, 5, 5, 4, 4, 5, 5, 7, 7, 6, 6];

// Seed table for the object-animation STATE block (OBJECT_ANIM_STATE_800D, below). Ten entries, same
// cell-i-takes-seed-i scheme.
const ANIM_STATE_SEEDS = [2, 2, 5, 5, 2, 2, 2, 2, 5, 5];

export function seedObjectAnimationState(m) {
  const { mem8 } = m;

  // ── Block 1: the object-animation CELL block ─────────────────────────────────────────
  // Fill fourteen stride-2 cells from OBJECT_ANIM_STATE_8021 (0x8021), i.e. 0x8021, 0x8023 … 0x803b, with
  // ANIM_CELL_SEEDS. These are the per-object animation counters the lane objects animate from. (The same
  // table region is later reused by renderMode4PointTablePhase, which stamps a mode-4 sprite code 3 into
  // it — so this seed is the objects' initial state at board start, not a permanent value.)
  for (let i = 0; i < ANIM_CELL_SEEDS.length; i++) {
    mem8[OBJECT_ANIM_STATE_8021 + OBJECT_STRIDE * i] = ANIM_CELL_SEEDS[i];
  }

  // ── Block 2: the object-animation STATE block ────────────────────────────────────────
  // Fill ten stride-2 cells from OBJECT_ANIM_STATE_800D (0x800d), i.e. 0x800d, 0x800f … 0x801f, with
  // ANIM_STATE_SEEDS. This block base overlaps other named cells that fall on its stride — e.g.
  // DEMO_SCROLL_REGISTER (0x800f) and OBJECT_ANIM_STATE_8015 (0x8015) — which the seed writes as it walks.
  for (let i = 0; i < ANIM_STATE_SEEDS.length; i++) {
    mem8[OBJECT_ANIM_STATE_800D + OBJECT_STRIDE * i] = ANIM_STATE_SEEDS[i];
  }
}
