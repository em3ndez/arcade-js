// SPDX-License-Identifier: GPL-3.0-only
// Once every 32 frames, and only while both master enables are set, sums each object's position weight
// across two tables, combines that with a scaled position offset and a random +/-1 nudge, and stores the
// result bucketed into a 0/4/8 movement selector.
import { advanceRandomSeed } from "./advanceRandomSeed.js";
import { accumulateObjectPositionWeight } from "./accumulateObjectPositionWeight.js";
import { FRAME_COUNTER, loc_4007, OBJ_ACTIVE_FLAG, OBJ_TABLE, loc_4260, loc_4202, loc_420e, OBJ_MOVE_CMD } from "./names.js";

// Arithmetic shift right of a signed byte by n, re-masked to a byte.
const asr = (v, n) => ((v << 24 >> 24) >> n) & 0xff;

export function computeControlledObjectMoveCommand(m) {
  const { mem8 } = m;

  // Act only when the 32-frame phase lands, and only while both master enables have bit 0 set.
  if (((mem8[FRAME_COUNTER] + 9) & 0x1f) !== 0) return;
  if (!(mem8[loc_4007] & 0x01)) return;
  if (!(mem8[OBJ_ACTIVE_FLAG] & 0x01)) return;

  // Fold every record of both object tables into a running weight.
  let total = 0;
  total = sumTable(m, OBJ_TABLE, 7, 32, 3, 4, 26, total);
  total = sumTable(m, loc_4260, 7, 5, 1, 3, 4, total);

  // Scale down a position offset, add the weight, halve, then apply a random +/-1 nudge.
  const scaled = asr((mem8[loc_420e] + 128 - mem8[loc_4202]) & 0xff, 5);
  const weight = asr((scaled + total) & 0xff, 1);
  const nudge = (advanceRandomSeed(m) & 0x80) ? -1 : 1;

  // Bucket the biased weight: negative -> 8, >=2 -> 4, else 0.
  const v = (weight + nudge + 1) & 0xff;
  mem8[OBJ_MOVE_CMD] = (v & 0x80) ? 8 : (v >= 2 ? 4 : 0);
}

// Add each of `count` records (from base, stepping by stride) into the total via its per-object weight.
function sumTable(m, base, count, stride, yOff, xOff, flagOff, total) {
  const { mem8 } = m;
  for (let i = 0, ix = base; i < count; i++, ix += stride) {
    total = accumulateObjectPositionWeight(m, ix, mem8[ix + yOff], mem8[ix + xOff], mem8[ix + flagOff], total);
  }
  return total;
}
