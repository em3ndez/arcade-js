// SPDX-License-Identifier: GPL-3.0-only
/**
 * computeControlledObjectMoveCommand -- the demo-mode autopilot brain: produce the auto/AI move command
 * that steers the ship during attract play.
 *
 * WHAT IT IS
 *   Runs on one frame in thirty-two and only while play is live, and computes OBJ_MOVE_CMD (0x423f) -- the
 *   byte moveControlledObjectAndStageSprite consumes to move the ship when no human is at the stick. It
 *   sums a "positional weight" over both object tables (how much threat is pulling from where), folds in a
 *   scaled anchor-vs-ship offset and a random +/-1 jitter, and buckets the result into a 0/4/8 command:
 *   hold, move one way, or move the other. The effect is a crude auto-pilot that drifts the demo ship
 *   toward the threat density, so attract-mode play looks purposeful.
 *
 * ROLE IN THE MACHINE
 *   The auto branch of the ship mover: with mode flag loc_4006 bit 0 clear the ship takes OBJ_MOVE_CMD;
 *   this routine is what fills it. accumulateObjectPositionWeight (0x1a12) is the per-object scorer -- it
 *   ignores inactive/too-high/too-far objects and adds a signed table step for the rest, so nearby, lower,
 *   threatening objects pull harder. loc_420e is the formation anchor; loc_4202 is the ship's own X.
 *
 * ROM 0x198e.  Grounding: [seen].
 *
 * LIVE-OUT: OBJ_MOVE_CMD (0x423f) := 0, 4, or 8, but only on the acted frame; otherwise no write.
 */
import { advanceRandomSeed } from "./advanceRandomSeed.js";
import { accumulateObjectPositionWeight } from "./accumulateObjectPositionWeight.js";
import { FRAME_COUNTER, loc_4007, OBJ_ACTIVE_FLAG, OBJ_TABLE, loc_4260, loc_4202, loc_420e, OBJ_MOVE_CMD } from "./names.js";

// Arithmetic shift right of a signed byte by n, re-masked to a byte (the Z80 does this with SRA + AND).
const asr = (v, n) => ((v << 24 >> 24) >> n) & 0xff;

export function computeControlledObjectMoveCommand(m) {
  const { mem8 } = m;

  // Act only when the 32-frame phase lands, and only while both master enables have bit 0 set.
  // FRAME_COUNTER is offset by nine before the &0x1f test so the phase falls at a fixed point in the
  // count; loc_4007 bit0 is the demo/auto enable and OBJ_ACTIVE_FLAG bit0 is the object-subsystem switch.
  if (((mem8[FRAME_COUNTER] + 9) & 0x1f) !== 0) return;
  if (!(mem8[loc_4007] & 0x01)) return;
  if (!(mem8[OBJ_ACTIVE_FLAG] & 0x01)) return;

  // Fold every record of both object tables into a running weight: the seven attacker records at
  // OBJ_TABLE (0x42d0, stride 32) and the seven moving-shot records at loc_4260 (stride 5). Each record's
  // (y, x, flag) fields are read at the given offsets and scored by accumulateObjectPositionWeight.
  let total = 0;
  total = sumTable(m, OBJ_TABLE, 7, 32, 3, 4, 26, total);
  total = sumTable(m, loc_4260, 7, 5, 1, 3, 4, total);

  // Scale down the anchor(0x420e)-vs-ship(0x4202) offset, add the weight, halve, then apply a random +/-1
  // nudge; the random bit comes from bit 7 of the advanced RNG seed.
  const scaled = asr((mem8[loc_420e] + 128 - mem8[loc_4202]) & 0xff, 5);
  const weight = asr((scaled + total) & 0xff, 1);
  const nudge = (advanceRandomSeed(m) & 0x80) ? -1 : 1;

  // Bucket the biased weight into the three-way command: negative (bit7 set) -> 8, >=2 -> 4, else 0 (hold).
  const v = (weight + nudge + 1) & 0xff;
  mem8[OBJ_MOVE_CMD] = (v & 0x80) ? 8 : (v >= 2 ? 4 : 0);
}

// Add each of `count` records (from base, stepping by stride) into the total via its per-object weight;
// yOff/xOff/flagOff pick the record's Y, X, and flag fields that the scorer inspects.
function sumTable(m, base, count, stride, yOff, xOff, flagOff, total) {
  const { mem8 } = m;
  for (let i = 0, ix = base; i < count; i++, ix += stride) {
    total = accumulateObjectPositionWeight(m, ix, mem8[ix + yOff], mem8[ix + xOff], mem8[ix + flagOff], total);
  }
  return total;
}
