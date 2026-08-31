// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  ROUND_COUNTER,
  ENEMY_SPAWN_TIMER,
  ACTIVE_ENEMY_COUNT,
  ANIM_TABLE_3829,
  SPAWN_FACING_TABLE_1209,
  SPAWN_TIMER_TABLE_11F9,
  HUNTER_SPAWN_COUNT,
} from "./names.js";
/**
 * loc_119a — initialise a spawned actor's record (based at IX).
 *
 * Skips a record whose id bytes are already odd (active). Otherwise it stamps the opening state
 * fields, seeds the +4 field from the caller, and derives a facing byte plus its negation and a
 * spawn-timer reload from a round-derived table index (two byte-table lookups). It arms the
 * record's animation, reloads the enemy spawn timer, and bumps two spawn counters.
 *
 * Returns a boolean skip-signal for its caller's scan: true when the record was already active (a
 * plain early return in the original — the caller keeps scanning); false once it has seeded a free
 * record (the original's pop-af skip-return aborting the caller's sweep). No register live-out — the
 * per-frame driver that consumes it reads only the boolean.
 */

export function loc_119a(m, rec = m.regs.ix, posSeed = m.regs.e) {
  const { mem8 } = m;

  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & 1) !== 0) return true; // already active -> keep scanning

  mem8[rec + 0x00] = 0x01; // mark active
  mem8[rec + 0x02] = 0x03; // opening state
  mem8[rec + 0x04] = posSeed; // caller-seeded position field
  mem8[rec + 0x03] = 0x00;
  mem8[rec + 0x05] = 0x00;
  mem8[rec + 0x06] = 0x00;
  mem8[rec + 0x08] = 0x00;
  mem8[rec + 0x07] = 0x01;
  mem8[rec + 0x0b] = 0x00;

  const idx = (mem8[ROUND_COUNTER] & 0x3f) >> 2;

  const facing = fetchByteFromTableIndex(m, SPAWN_FACING_TABLE_1209, idx)[0];
  mem8[rec + 0x09] = facing;
  mem8[rec + 0x0a] = -facing; // negated facing

  setActorAnimation(m, rec, ANIM_TABLE_3829);

  mem8[ENEMY_SPAWN_TIMER] = fetchByteFromTableIndex(m, SPAWN_TIMER_TABLE_11F9, idx)[0];

  mem8[HUNTER_SPAWN_COUNT] = mem8[HUNTER_SPAWN_COUNT] + 1;
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] + 1;
  return false; // seeded a free record -> caller ends its sweep (original's skip-return)
}
