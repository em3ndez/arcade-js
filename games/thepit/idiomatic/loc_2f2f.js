// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2f2f — seed the first block of round/level parameters, derive the
 * animation reload byte, then hand off to loc_30de.  ROM 0x2f2f.
 *
 * The first half of the round/level parameter-seeding pass: it fills its own block
 * of subsystem parameter/counter bytes with fixed start values, then derives a
 * single animation-reload byte from the round's level/difficulty counter and jumps
 * straight into loc_30de, which seeds the second block. The reload byte counts down
 * as difficulty climbs: it increments the counter, holds it at a ceiling of four,
 * and takes seven minus that — 6, 5, 4, then a floor of 3 — so the animation reloads
 * sooner (a shorter cadence) at harder levels. The hand-off is a tail jump:
 * loc_30de's own return unwinds back to loc_2f2f's caller, so the delegation IS
 * loc_2f2f's exit.
 *
 * Every write lands on a distinct work-RAM byte, so their order does not affect the
 * resulting state.
 *
 * Name kept as loc_2f2f: like its sibling loc_30de, the block it seeds drives a
 * subsystem that is not yet identified — the counter it reads is the named LEVEL field,
 * but the block's own role is a best-effort reading, below the bar to promote to an
 * English name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2f2f.test.js.
 * GATE:     crafted-entry — never dispatched in attract (it runs only from the
 *           gameplay round-init tail-jump chain loc_287a → loc_2f2f → loc_30de, which
 *           attract never reaches), so it is validated on real captured attract
 *           machine states. It reads only the difficulty counter, so any realistic
 *           state is a valid entry: EQUAL over several captured states + a full
 *           counter sweep + a sentinel-preset entry that makes every write
 *           observable, and the teeth twins are caught.
 * LIVE-OUT: memory-only — the seeded parameter bytes and the derived reload byte. The
 *           round-init caller consumes the seeded memory, not any register; the tail
 *           owns everything after the hand-off, identically on both sides.
 * NAMES:    from ram.js — BG_SPRITE_X/FRAME/ATTR/Y (0x80db–0x80de), ANIM_PHASE_COUNTER
 *           (0x80e3), REVEAL_PERIOD (0x80e4), REVEAL_GATE (0x80e5), REVEAL_CURSOR (0x80e6),
 *           GOAL_TILE_LATCH (0x80e7), and the LEVEL difficulty counter (0x8028); only
 *           0x80df–0x80e0 in the block stay unnamed hex. The tail is the decompiled
 *           loc_30de (ROM 0x30de).
 */

import { loc_30de } from "./loc_30de.js";

import {
  ANIM_PHASE_COUNTER,
  BG_SPRITE_ATTR,
  BG_SPRITE_FRAME,
  BG_SPRITE_X,
  BG_SPRITE_Y,
  GOAL_TILE_LATCH,
  LEVEL,
  REVEAL_CURSOR,
  REVEAL_GATE,
  REVEAL_PERIOD,
} from "./ram.js";
export function loc_2f2f(m) {
  const { mem8 } = m;

  // Fixed start values for the parameter/counter block.
  mem8[BG_SPRITE_X] = 40;
  mem8[BG_SPRITE_FRAME] = 57;
  mem8[BG_SPRITE_ATTR] = 192;
  mem8[BG_SPRITE_Y] = 120;
  mem8[0x80df] = 1;
  mem8[0x80e0] = 252;
  mem8[ANIM_PHASE_COUNTER] = 1;
  mem8[REVEAL_GATE] = 1;
  mem8[REVEAL_CURSOR] = 150;
  mem8[GOAL_TILE_LATCH] = 0;

  // Animation reload byte, scaled by difficulty. Increment the round's
  // level/difficulty counter (wrapping in one byte), hold it at a ceiling of four,
  // and take seven minus that. As the level rises the reload steps down 6, 5, 4 and
  // then floors at 3 — a shorter animation cadence at harder levels.
  const cappedLevel = Math.min((mem8[LEVEL] + 1) & 0xff, 4);
  mem8[REVEAL_PERIOD] = 7 - cappedLevel;

  // Tail hand-off into loc_30de; its return goes to our caller, so this is
  // loc_2f2f's exit.
  return loc_30de(m);
}
