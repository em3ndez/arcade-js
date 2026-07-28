// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnPendingDigObject — pop a random queued column and spawn a dig object there.  ROM 0x2c04.
 *
 * A queue of up to 24 columns waiting to spawn lives in work RAM (12 left-of-centre
 * columns paired one-for-one with 12 right-of-centre ones). This routine dequeues ONE
 * of them at random and brings a new dig object into the maze at that column:
 *   - raises the spawn-active flag and plays the spawn sound;
 *   - seeds the dig object's staging bytes — its spawn-phase code, colour attribute,
 *     and lifetime timer (copied from the reload byte);
 *   - draws random queue slots until it lands on one that holds a column, removes that
 *     column from the queue, and — for a left-half column — switches to its paired
 *     right-half column when that one is also queued;
 *   - turns the chosen column into a tilemap cell, paints the spawn tile into it, and
 *     records whether the new cell lands on top of the tracked player object;
 *   - hands off to the dig-object sprite-record builder to finish the spawn.
 *
 * The overlap flag it publishes lets the follow-on reaction know the spawn appeared
 * on the player. The name states what the routine does (spawn from the queue); the
 * exact contents of the queue and the meaning of the spawn tile are not fully pinned.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c04.test.js.
 * GATE:     crafted-entry — the spawn path is never dispatched in attract, so the gate
 *           runs the routine from real captured attract machines with the queue poked so
 *           a column is available, sweeping left-only / right-only / paired columns and
 *           the on-player / off-player cases; the dead stack the oracle's dissolved
 *           helper calls leave just below the entry stack pointer is excluded, exactly
 *           as it is for the sound stubs.
 * LIVE-OUT: memory-only — the queue slot cleared, the dig-object staging bytes, the
 *           painted tilemap cell, the target coordinates, and the player-overlap flag.
 *           The oracle's exit registers/flags are dead; the tail hand-off is identical
 *           on both sides so the Z80 return path lines up for free.
 * NAMES:    SPAWN_STATE, DIG_OBJ_STATE, DIG_OBJ_ATTR, DIG_OBJ_TIMER, TARGET_X, TARGET_Y,
 *           OBJ_X, OBJ_Y, DIG_OVERLAP_HOLD (the byte this routine writes the overlap flag to),
 *           and DIG_SPAWN_QUEUE (the 24-slot queue base) from ram.js. Its reload byte
 *           (0x80c2) has no ram.js name yet, kept hex.
 */

import { advanceRandom } from "./advanceRandom.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";
import { requestSound18 } from "./requestSound18.js";
import {
  SPAWN_STATE,
  DIG_OBJ_STATE,
  DIG_OBJ_ATTR,
  DIG_OBJ_TIMER,
  TARGET_X,
  TARGET_Y,
  OBJ_X,
  OBJ_Y,
  DIG_OVERLAP_HOLD,
  DIG_SPAWN_QUEUE,
} from "./ram.js";
import { u8 } from "../../../core/int.js";

// Byte the dig-object lifetime timer is seeded from at spawn.
const DIG_TIMER_RELOAD = 0x80c2;

// The tile code painted into the spawned cell.
const SPAWN_TILE = 37;
// Tilemap RAM base; the row is inverted (top of the map is the highest row index).
const TILEMAP_BASE = 0x9000;

export function spawnPendingDigObject(m) {
  const { mem8 } = m;

  // Begin a spawn: raise the active flag, play the spawn sound, and seed the dig
  // object's staging bytes.
  mem8[SPAWN_STATE] = 1;
  requestSound18(m);
  mem8[DIG_OBJ_STATE] = 16; // spawn-phase code
  mem8[DIG_OBJ_ATTR] = 6; // colour attribute
  mem8[DIG_OBJ_TIMER] = mem8[DIG_TIMER_RELOAD]; // lifetime for the new object

  // Draw random queue slots until one holds a column. Each draw keeps the low 5 bits
  // (0..31) and rejects 24..31, so it picks uniformly among the 24 slots.
  let slot;
  do {
    slot = advanceRandom(m) & 0x1f;
  } while (slot >= 24 || mem8[DIG_SPAWN_QUEUE + slot] === 0);

  // The chosen column and the value stored in its slot. A left-half column (0..11)
  // switches to its paired right-half column (+12) when that one is also queued.
  let column = slot;
  let value = mem8[DIG_SPAWN_QUEUE + slot];
  if (slot < 12) {
    const pairedValue = mem8[DIG_SPAWN_QUEUE + slot + 12];
    if (pairedValue !== 0) {
      column = slot + 12;
      value = pairedValue;
    }
  }

  // Dequeue the chosen column and turn it into a cell coordinate: one axis from the
  // slot value, the other a fixed left/right column base.
  mem8[DIG_SPAWN_QUEUE + column] = 0;
  mem8[TARGET_X] = value + 1;
  mem8[TARGET_Y] = column < 12 ? 183 : 191; // left vs right column-base coordinate

  // Paint the spawn tile into the tilemap cell those coordinates map to.
  const targetX = mem8[TARGET_X];
  const targetY = mem8[TARGET_Y];
  const invertedRow = 31 - (targetX >> 3);
  const cellColumn = (targetY + 1) >> 3;
  mem8[TILEMAP_BASE + invertedRow * 32 + cellColumn - 31] = SPAWN_TILE;

  // Flag whether the new cell lands on the tracked player object: same column band,
  // and the player within an 8-pixel window just ahead of the spawn.
  let landsOnPlayer = 0;
  if (targetY + 12 === mem8[OBJ_Y]) {
    const playerX = mem8[OBJ_X];
    if (targetX < playerX && u8(targetX + 8) >= playerX) landsOnPlayer = 1;
  }
  mem8[DIG_OVERLAP_HOLD] = landsOnPlayer;

  // Finish the spawn: build the dig-object sprite record (still the oracle), whose
  // return unwinds to this routine's own caller.
  return stageDigObjectSpriteRecord(m);
}
