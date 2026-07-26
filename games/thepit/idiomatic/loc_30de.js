// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_30de — seed the second block of round/level parameters, derive one
 * difficulty-scaled byte pair, then hand off to seedActorSpawnState.  ROM 0x30de.
 *
 * The second half of the round/level parameter-seeding pass — loc_2f2f fills the
 * first block, then jumps straight here. This routine fills its own block of
 * subsystem parameter/counter bytes with fixed start values, derives a single pair
 * of bytes from the round's level/difficulty counter, and writes that pair into two
 * mirrored slots. The pair scales with difficulty: keeping only two selector bits of
 * the counter and subtracting from seven, it steps down 7, 5, 3, 1 as difficulty
 * climbs — a smaller value at a harder level. It then hands straight on to
 * seedActorSpawnState, which puts the actor pair's records into their start state.
 * That hand-off is a tail jump: seedActorSpawnState's own return unwinds back to
 * loc_30de's caller, so the delegation IS loc_30de's exit.
 *
 * Every write lands on a distinct work-RAM byte, so their order does not affect the
 * resulting state; the two mirrored slots always receive the same derived value.
 *
 * Name kept as loc_30de: the block it seeds drives a subsystem that is not yet
 * identified, and the counter it reads is not a confirmed, named field — the role is
 * a best-effort reading, below the bar to promote to an English name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-30de.test.js.
 * GATE:     crafted-entry — never dispatched in attract (it runs only from the
 *           gameplay round-init tail-jump chain, which attract never reaches), so it
 *           is validated on real captured attract machine states. It reads only the
 *           difficulty counter, so any realistic state is a valid entry: EQUAL over
 *           several captured states + a sentinel-preset entry that makes every write
 *           observable, and the teeth twins are caught.
 * LIVE-OUT: memory-only — the seeded parameter bytes and the derived pair. The
 *           round-init caller consumes the seeded memory, not any register; the tail
 *           owns everything after the hand-off, identically on both sides.
 * NAMES:    none from ram.js — every address this touches (the 0x80e8–0x8109
 *           parameter block and the 0x8028 difficulty counter) is still unnamed. The
 *           tail is the decompiled seedActorSpawnState (ROM 0x36fe).
 */

import { seedActorSpawnState } from "./seedActorSpawnState.js";

export function loc_30de(m) {
  const { mem } = m;

  // Fixed start values for the parameter/counter block.
  mem.write8(0x80e9, 9);
  mem.write8(0x80e8, 236);
  mem.write8(0x80eb, 35);
  mem.write8(0x80ea, 4);
  mem.write8(0x80f5, 1);
  mem.write8(0x80f0, 1);
  mem.write8(0x80f8, 4);

  // Difficulty-scaled pair: read the round's level/difficulty counter, keep only its
  // two low-order selector bits (leaving 0, 2, 4, or 6), and subtract from seven so
  // the pair steps down 7, 5, 3, 1 as difficulty climbs. Both mirrored slots get it.
  const difficultyStep = 7 - (mem.read8(0x8028) & 0x06);
  mem.write8(0x80f6, difficultyStep);
  mem.write8(0x8107, difficultyStep);

  // More fixed start values.
  mem.write8(0x80fa, 9);
  mem.write8(0x80fb, 4);
  mem.write8(0x80f9, 0);
  mem.write8(0x8106, 0);
  mem.write8(0x8101, 1);
  mem.write8(0x8109, 5);

  // Tail hand-off into seedActorSpawnState; its return goes to our caller, so this
  // is loc_30de's exit.
  return seedActorSpawnState(m);
}
