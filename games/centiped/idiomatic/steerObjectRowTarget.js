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

// bcdReduceBy6 -- subtract 6 from a packed-BCD byte (two decimal digits per byte), emulating the
// 6502's decimal-mode SBC #6 with no borrow-in. The low nibble is reduced first and, if it borrows,
// the 6502's decimal fix-up (-6 on the nibble) is applied and 0x10 taken from the high half; a final
// negative result is corrected by -0x60, the decimal wrap. The caller decides the sign separately from
// the plain-binary result, so this returns only the magnitude byte. It scales a per-object counter into
// a small "distance" figure used to judge how near the object is to its row target.
function bcdReduceBy6(v) {
  let low = (v & 0x0f) - 6;
  if (low < 0) low = ((low - 6) & 0x0f) - 0x10;
  let result = (v & 0xf0) + low;
  if (result < 0) result -= 0x60;
  return result & 0xff;
}

/**
 * steerObjectRowTarget — commit an object's new row target and steer its drift toward it
 * (ROM 0x2280). [code]
 *
 * ROLE. Part of the small machine (fed by advanceColumnHeadingState) that walks a
 * non-centipede object — spider, flea, scorpion — vertically toward a chosen row rather
 * than marching it like a centipede segment. The caller hands the new target row in A; this
 * routine records it, deals with any mushroom sitting at that row, and then decides which
 * way the object's vertical drift should point before handing off to the step that actually
 * folds the object one notch toward the target.
 *
 * MECHANISM. Three decisions in sequence. (1) Consume a mushroom: if the tile cell at the
 * target is occupied by a HIGH tile class (>= 0x38 in its low six bits — the mushroom band)
 * it is cleared and the matching count is decremented, i.e. the object ate it. (2) Bail on a
 * retired column: loc_61 == 0xff means this column is dead, so just reseed spawn state. (3)
 * Otherwise choose the drift direction by combining a keyed DISTANCE to the target (from the
 * BCD-reduced per-object counter above, halved, clamped and scaled), the sign of the object's
 * vertical steer delta OBJECT_Y_STEER (0x81, [seen] — a negative delta means "heading up"),
 * and a same-column collision test — flipping the steer delta only when the evidence says the
 * object should turn around. Finally it dispatches the distance-fold step.
 *
 * LIVE-OUT. Writes loc_71 (the row target), possibly a tile cell + its count, loc_8d (scaled
 * distance scratch), and OBJECT_Y_STEER; tail-calls armSlotWhenObjectInRange (or reseeds).
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
