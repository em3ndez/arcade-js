// SPDX-License-Identifier: GPL-3.0-only
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { maybeDecrementTableEntry } from "./maybeDecrementTableEntry.js";
import { seedSegmentSpawnState } from "./seedSegmentSpawnState.js";
import { detectColumnCollision } from "./detectColumnCollision.js";
import { negateA } from "./negateA.js";
import { armSlotWhenObjectInRange } from "./armSlotWhenObjectInRange.js";
import {
  loc_71, loc_61, loc_f0, loc_88, loc_ab, loc_8d, loc_ef, OBJECT_Y_STEER, TILEMAP_PTR_LO,
} from "./names.js";

// Packed-BCD subtract of 6 with no borrow-in (the caller handles the sign via the plain-binary result).
function bcdReduceBy6(v) {
  let low = (v & 0x0f) - 6;
  if (low < 0) low = ((low - 6) & 0x0f) - 0x10;
  let result = (v & 0xf0) + low;
  if (result < 0) result -= 0x60;
  return result & 0xff;
}

/**
 * steerObjectRowTarget — commit a new row target for an object and steer its drift toward it.
 *
 * Stores the target row, and if the resolved tile cell there is occupied by a high tile class, clears
 * it and decrements the matching table entry. When the column is retired it just reseeds the spawn
 * state. Otherwise it decides — from a keyed distance derived from a BCD-reduced per-object counter, a
 * heading sign check, and a same-column collision test — whether to flip the drift cell, then dispatches
 * the distance-fold step. [code]
 */
export function steerObjectRowTarget(m, a = m.regs.a) {
  const { mem8, mem16 } = m;

  mem8[loc_71] = a; // commit the new row target

  // If the tile cell here is occupied by a high tile class, clear it and decrement its table entry.
  const [, cellEmpty] = resolveTileCellAtXY(m, a, 0);
  if (!cellEmpty) {
    const cellPtr = mem16[TILEMAP_PTR_LO];
    if ((mem8[cellPtr] & 0x3f) >= 0x38) {
      mem8[cellPtr] = 0x00;
      maybeDecrementTableEntry(m);
    }
  }

  // Retired column: reseed the spawn state and return.
  if (mem8[loc_61] === 0xff) {
    seedSegmentSpawnState(m);
    return;
  }

  let steer = false;         // flip the drift cell
  let collisionTest = false; // run the same-column collision dispatch

  const keyed = (mem8[loc_71] ^ mem8[loc_f0]) & 0xff;
  if (keyed >= 0x09) {
    // Distance from a BCD-reduced per-object counter, floored at 0 when the plain subtract goes negative.
    const raw = mem8[(loc_ab + mem8[loc_88]) & 0xff];
    let scaled = ((raw - 6) & 0x80) !== 0 ? 0 : bcdReduceBy6(raw);
    scaled >>= 1;
    if (scaled >= 6) scaled = 5;
    scaled = (scaled << 3) & 0xff;
    mem8[loc_8d] = scaled;
    const dist = ((0x60 ^ mem8[loc_f0]) - scaled) & 0xff;
    const near = mem8[loc_ef] === 0 ? dist >= mem8[loc_71] : dist < mem8[loc_71];
    if (near) collisionTest = true;
    else if (mem8[OBJECT_Y_STEER] & 0x80) steer = true; // negative heading -> steer
    else collisionTest = true;
  } else if (mem8[OBJECT_Y_STEER] & 0x80) {
    collisionTest = true; // negative heading -> collision dispatch
  } else {
    steer = true;         // positive heading -> steer
  }

  // A real same-column collision flips the drift cell before the dispatch.
  if (collisionTest && detectColumnCollision(m, 0x0d)) steer = true;
  if (steer) mem8[OBJECT_Y_STEER] = negateA(m, mem8[OBJECT_Y_STEER]);

  // Dispatch the distance-fold step (it reads the object index the seat provides).
  return armSlotWhenObjectInRange(m, 0x0d);
}
