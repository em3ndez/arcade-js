// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedActorSpawnState — put the two-body actor (a primary sprite and its twin) into
 * its fixed starting state and drop it back to the un-spawned phase.  ROM 0x36fe.
 *
 * The tail of the round/level parameter-seeding chain (loc_2f2f → loc_30de → here):
 * loc_30de fills one block of subsystem parameters, then hands straight to this,
 * which fills the actor pair's records. Both records are written from constants —
 * nothing is read — so the pair always starts in the same pose:
 *
 *   - Primary body: parked at a fixed start column and the top row of its lane,
 *     carrying a two-byte per-step move vector and a fully-armed cadence timer.
 *   - Twin body: the same body shifted 16 columns to the right with the next tile
 *     code — a shadow sprite drawn alongside the primary. Its move vector starts at
 *     zero; its timer is armed like the primary's.
 *   - The spawn-phase flag is cleared, marking the pair "not yet spawned" so the
 *     spawn dispatch will re-arm it on the next pass.
 *
 * All fifteen writes land on distinct work-RAM bytes, so their order does not affect
 * the resulting state.
 *
 * Memory-equivalent to the frozen oracle — equivalence-36fe.test.js.
 * GATE:     crafted-entry — never entered during attract (it runs only from the
 *           gameplay round-init tail-jump, which attract never reaches), so it is
 *           validated on real captured attract machine states. It reads no input, so
 *           any realistic state proves it; a sentinel-preset entry makes every write
 *           observable, and the teeth twin is caught.
 * LIVE-OUT: memory-only — the fifteen seeded work-RAM bytes. The residual accumulator
 *           value is dead ABI; the round-init caller consumes no register.
 * NAMES:    SPAWN_PHASE, ACTOR_X/ACTOR_TILE/ACTOR_Y/ACTOR_TIMER, TWIN_X/TWIN_TILE/
 *           TWIN_CLEAR from ram.js. The neighbour fields 0x810c/0x810e/0x810f (primary)
 *           and 0x811d/0x811f/0x8120/0x8123 (twin) are still unnamed within the same two
 *           records, so their addresses stay hex.
 */

import {
  SPAWN_PHASE,
  ACTOR_X,
  ACTOR_TILE,
  ACTOR_Y,
  ACTOR_TIMER,
  TWIN_X,
  TWIN_TILE,
  TWIN_CLEAR,
} from "./ram.js";

export function seedActorSpawnState(m) {
  const { mem } = m;

  // Primary body.
  mem.write8(ACTOR_X, 36); // start column
  mem.write8(ACTOR_TILE, 46); // tile/sprite code
  mem.write8(ACTOR_Y, 0); // start row — top of the lane
  mem.write8(0x810c, 151); // paired display byte (mirrored on the twin)
  mem.write8(0x810e, 0); // per-step move vector, low byte
  mem.write8(0x810f, 1); // per-step move vector, high byte
  mem.write8(ACTOR_TIMER, 1); // cadence timer, armed

  // Twin body — the primary shifted 16 columns right, next tile code.
  mem.write8(TWIN_X, 52); // twin start column (primary + 16)
  mem.write8(TWIN_TILE, 47); // twin tile code (one past the primary's)
  mem.write8(TWIN_CLEAR, 0); // twin start row (mirror of the primary row)
  mem.write8(0x811d, 151); // twin paired display byte (mirror of 0x810c)
  mem.write8(0x811f, 0); // twin move vector, low byte
  mem.write8(0x8120, 0); // twin move vector, high byte
  mem.write8(0x8123, 1); // twin cadence timer, armed

  // Back to the un-spawned phase.
  mem.write8(SPAWN_PHASE, 0);
}
