// SPDX-License-Identifier: GPL-3.0-only
/**
 * accumulateObjectPositionWeight — per-object contribution to the demo auto-pilot's threat weight.
 *
 * WHAT IT IS
 *   A register-only scorer: it writes no memory, it only folds its result back into accumulator B.
 *   Given one object record it decides whether that object should tug the demo-mode ship and by how
 *   much. When the object clears every gate a signed step read from OBJ_STEP_TABLE is added to the
 *   running total in B; an object that fails any gate leaves the total untouched.
 *
 * ROLE IN THE MACHINE
 *   Called once per object, across both object tables, by computeControlledObjectMoveCommand
 *   (ROM 0x198e) — the attract/demo auto-pilot "brain". Once every 32 frames that routine sums this
 *   weight over the attacker records (OBJ_TABLE, stride 32) and the moving-shot records (stride 5),
 *   adds a scaled anchor-vs-reference offset and a random +/-1 nudge, and buckets the biased total into
 *   OBJ_MOVE_CMD = 0/4/8 so the demo ship drifts toward the densest threat. Nearby, lower, threatening
 *   objects therefore pull harder than distant ones. loc_4202 (0x4202) is the ship's own X reference;
 *   OBJ_STEP_TABLE (0x1a45) is the 16-entry signed step lookup.
 *
 * ROM 0x1a12.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: B (m.regs.b) = the updated accumulator. No memory is written.
 */
import { loc_4202, OBJ_STEP_TABLE } from "./names.js";

export function accumulateObjectPositionWeight(m, objPtr = m.regs.ix, objY = m.regs.h, objX = m.regs.l, objFlags = m.regs.c, total = m.regs.b) {
  const { mem8 } = m;

  // Gate 1 — inactive objects contribute nothing. Byte 0 bit 0 of the record is the primary active
  // flag; when it is clear the slot holds no live attacker, so return B unchanged.
  if (!(mem8[objPtr] & 0x01)) return (m.regs.b = total);

  // Gate 2 — vertical band. Only objects at Y >= 128 that land in one of two stacked 52-row bands
  // count: band 0 is the near band (row 0..51), band 1 the far band (row 52..103). Anything above the
  // split (row < 0) or below both bands (row >= 104) is out of range and drops out.
  const row = objY - 128;
  let band;
  if (row < 0) return (m.regs.b = total);
  if (row < 52) band = 0;
  else if (row < 104) band = 1;
  else return (m.regs.b = total);

  // Gate 3 — horizontal range. Take the object's distance from the ship reference X (loc_4202),
  // biased by 64 and wrapped to a byte; once it reaches the top half (>= 128) the object is too far
  // to the side to matter, so it contributes nothing.
  const delta = (mem8[loc_4202] - objX - 64) & 0xff;
  if (delta >= 128) return (m.regs.b = total);

  // Fold flag bit 7 and delta bits 5-6 down into the low nibble (rotate the byte's two halves so those
  // bits move to the bottom), then OR in the band bit to form a 0-15 index into OBJ_STEP_TABLE.
  const bits = (objFlags & 0x80) | (delta & 0x60);
  const index = (((bits >> 4) | (bits << 4)) & 0xff) | band;

  // Add this bucket's signed step to the running total (byte-wrapped) and publish it back into B.
  return (m.regs.b = (total + mem8[OBJ_STEP_TABLE + index]) & 0xff);
}
