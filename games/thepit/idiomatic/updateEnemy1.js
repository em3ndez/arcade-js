// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateEnemy1 — the per-frame enemy pass: drive enemy 1 (record 0x80e8) through the shared
 * move/collision driver (stepEnemyMover), stage its sprite record, then hand off enemy 2.  ROM 0x312d. (§2.4)
 *
 * This is the object-record analog of advanceActorMovers: the two mover records OBJ1
 * (0x80e8) and OBJ2 (0x80f9) are the OBJ1/OBJ2 movers, distinct from the tracked object
 * (the player). The shared move/collision driver (stepEnemyMover) works out of one fixed
 * working block, so each record is stepped the same way — copy the 17-byte record into
 * the working block, run the driver to step and collide it in place, then copy the
 * result back.
 *
 *   - Until the intro/phase counter has passed its opening (< 8), run neither mover this
 *     frame — hand the frame straight to the actor dispatcher.
 *   - Object 1 always steps: drive it through the mover, commit it, then stage its
 *     sprite record — three record bytes verbatim plus a fourth = record byte 3 shifted
 *     by the cabinet sprite-coordinate bias (0 in normal upright play).
 *   - Object 2 then runs the identical pass in updateEnemy2, which stages its record and
 *     hands the frame to the actor dispatcher — EXCEPT in the attract demo (game mode 4)
 *     while the counter is still in its opening window (< 10), when only object 1 moves
 *     and the frame goes straight to the actor dispatcher.
 *
 * Object 2's half (updateEnemy2) and the actor dispatcher (advanceTwoSpriteActor) are decompiled, so this
 * calls them directly; both are tail calls, so their return goes to this routine's caller.
 * The mover core stepEnemyMover and object 2's updateEnemy2 keep neutral names for the same reason
 * the whole mover cluster does — the tilemap's on-screen axis and what a probe match means
 * for travel are not yet pinned — but the wrapper's job (marshal a record through the
 * driver, stage its sprite) is clear, exactly as it is for the blessed sibling
 * advanceActorMovers.
 *
 * Memory-equivalent to the frozen oracle — equivalence-312d.test.js.
 * GATE:     real captured attract dispatches (the per-frame backdrop driver advanceZonker
 *           tail-jumps here every frame) + crafted counter/mode entries that force each
 *           branch (skip-both, object-1-only, object-1+object-2), compared to the oracle
 *           over work RAM (dumpState) outside the dead stack scratch the oracle's driver
 *           calls leave. The mover's rare arrival/capture tails that reach the round-
 *           boundary busy-waits are stubbed identically on both sides. Teeth catch a
 *           dropped sprite-coordinate bias and a corrupted verbatim record byte.
 * LIVE-OUT: memory-only — object 1's committed record, its four staged sprite bytes, and
 *           whatever the mover / delegated tails leave. Reached by tail-jump; no caller
 *           reads a value register back (dead ABI).
 * NAMES:    PLAY_PHASE_COUNTER (0x8010), ENEMY1_X (0x80e8, base of object 1's record),
 *           SPRITE_COORD_BIAS (0x8051), GAME_STATE (0x8001), SPRITE_STAGING_BASE (0x8220)
 *           from ram.js. Kept hex: 0x8083 (the driver's shared working block) has no
 *           ram.js name yet. updateEnemy2 / advanceTwoSpriteActor are decompiled and called directly.
 */

import { stepEnemyMover } from "./stepEnemyMover.js";
import { advanceTwoSpriteActor } from "./advanceTwoSpriteActor.js";
import { updateEnemy2 } from "./updateEnemy2.js";
import { PLAY_PHASE_COUNTER, ENEMY1_X, SPRITE_COORD_BIAS, GAME_STATE, SPRITE_STAGING_BASE } from "./ram.js";

// The move/collision driver's shared working block: a record is copied in, driven in
// place, then copied back out.
const MOVER_SCRATCH = 0x8083;
// Object 1's 4-byte record in the sprite-staging buffer (0x8230).
const OBJ1_SPRITE_RECORD = SPRITE_STAGING_BASE + 16;
// The move records (and their working-block copies) are 17 bytes each.
const RECORD_SIZE = 17;

/** Advance one 17-byte object record through the move/collision driver: copy it into the
 *  driver's working block, run the driver, then copy the stepped result back. */
function driveRecordThroughMover(m, recordBase) {
  const { mem8 } = m;
  for (let i = 0; i < RECORD_SIZE; i++) mem8[MOVER_SCRATCH + i] = mem8[recordBase + i];
  stepEnemyMover(m);
  for (let i = 0; i < RECORD_SIZE; i++) mem8[recordBase + i] = mem8[MOVER_SCRATCH + i];
}

export function updateEnemy1(m) {
  const { mem8 } = m;

  // Until the intro/phase counter has passed its opening, neither object mover steps.
  if (mem8[PLAY_PHASE_COUNTER] < 8) return advanceTwoSpriteActor(m);

  // Object 1 always steps, then stages its sprite record: three bytes verbatim, then its
  // 4th byte shifted by the cabinet sprite-coordinate bias.
  driveRecordThroughMover(m, ENEMY1_X);
  for (let i = 0; i < 3; i++) mem8[OBJ1_SPRITE_RECORD + i] = mem8[ENEMY1_X + i];
  mem8[OBJ1_SPRITE_RECORD + 3] = mem8[ENEMY1_X + 3] + mem8[SPRITE_COORD_BIAS];

  // Object 2 runs the identical pass next — unless this is the attract demo while the
  // counter is still low, when only object 1 moves this frame.
  if (mem8[GAME_STATE] === 4 && mem8[PLAY_PHASE_COUNTER] < 10) return advanceTwoSpriteActor(m);
  return updateEnemy2(m);
}
