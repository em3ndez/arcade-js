// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedActorSpawnState — put the two-body actor (a primary sprite and its twin) into
 * its fixed starting state and drop it back to the un-spawned phase.  ROM 0x36fe.
 *
 * The tail of the round/level parameter-seeding chain (seedChamberCreature → seedEnemyRecords → here):
 * seedEnemyRecords fills one block of subsystem parameters, then hands straight to this,
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
 * NAMES:    BOARD_END_PHASE, ENEMY3_X/ENEMY3_TILE/ENEMY3_Y/ENEMY3_STEP_X/ENEMY3_STEP_Y/ENEMY3_TIMER,
 *           ENEMY3_TWIN_X/ENEMY3_TWIN_TILE/ENEMY3_TWIN_Y/ENEMY3_TWIN_ATTR/ENEMY3_TWIN_TIMER from ram.js. The neighbour
 *           primary field 0x810c is ENEMY3_ATTR (ram.js); the twin fields 0x811f/0x8120 are still
 *           unnamed within the same records, so their addresses stay hex.
 */

import {
  ENEMY3_ATTR,
  ENEMY3_STEP_X,
  ENEMY3_STEP_Y,
  ENEMY3_TILE,
  ENEMY3_TIMER,
  ENEMY3_X,
  ENEMY3_Y,
  BOARD_END_PHASE,
  ENEMY3_TWIN_ATTR,
  ENEMY3_TWIN_Y,
  ENEMY3_TWIN_TILE,
  ENEMY3_TWIN_TIMER,
  ENEMY3_TWIN_X,
} from "./ram.js";

export function seedActorSpawnState(m) {
  const { mem8 } = m;

  // Primary body.
  mem8[ENEMY3_X] = 36; // start column
  mem8[ENEMY3_TILE] = 46; // tile/sprite code
  mem8[ENEMY3_Y] = 0; // start row — top of the lane
  mem8[ENEMY3_ATTR] = 151; // paired display byte (mirrored on the twin)
  mem8[ENEMY3_STEP_X] = 0; // per-step move vector, low byte
  mem8[ENEMY3_STEP_Y] = 1; // per-step move vector, high byte
  mem8[ENEMY3_TIMER] = 1; // cadence timer, armed

  // Twin body — the primary shifted 16 columns right, next tile code.
  mem8[ENEMY3_TWIN_X] = 52; // twin start column (primary + 16)
  mem8[ENEMY3_TWIN_TILE] = 47; // twin tile code (one past the primary's)
  mem8[ENEMY3_TWIN_Y] = 0; // twin start row (mirror of the primary row)
  mem8[ENEMY3_TWIN_ATTR] = 151; // twin paired display byte (mirror of 0x810c)
  mem8[0x811f] = 0; // twin move vector, low byte
  mem8[0x8120] = 0; // twin move vector, high byte
  mem8[ENEMY3_TWIN_TIMER] = 1; // twin cadence timer, armed

  // Back to the un-spawned phase.
  mem8[BOARD_END_PHASE] = 0;
}
