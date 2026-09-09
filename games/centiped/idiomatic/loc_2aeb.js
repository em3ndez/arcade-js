// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_63, loc_73, MOVE_SUBSTEP_ACCUM_B, loc_86, loc_8b, loc_bb } from "./names.js";
import { clampAndHalveSignedDelta } from "./clampAndHalveSignedDelta.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { negateA } from "./negateA.js";
import { clampCoordToBand } from "./clampCoordToBand.js";

/**
 * loc_2aeb (ROM 0x2aeb) -- the $73-axis half of the movement integrator pair, the companion the
 * $63-axis stage `loc_2ace` falls straight into with the halved delta already in A. This is the
 * sub-pixel machine that turns a signed per-frame delta into smooth, collision-gated motion: each
 * frame it folds a fraction of a step into the object's coordinate, and a filled tile cell in the
 * destination simply refuses the move.
 *
 * Role in the machine: given the incoming halved delta (A) plus carry, it advances the `$63`
 * coordinate, parks the running sum in the scratch `$8b`, and consults the tilemap at the object's
 * `$73` column, row 0. If that cell is occupied the coordinate is held unchanged (an object cannot
 * walk into a filled square); if empty, the new coordinate is admitted but clamped into the playable
 * band [$0b, $f4] so it can never leave the field. It then, gated by the master enable `$86`, negates
 * and halves the `$bb` source delta (zeroing `$bb` as it consumes it), folds the result into the
 * `$73`-axis fractional accumulator MOVE_SUBSTEP_ACCUM_B ($85) [seen], and tail-calls the next stage.
 *
 * Live-out: `$63` (clamped coordinate), `$8b` (running sum), `$bb` cleared, MOVE_SUBSTEP_ACCUM_B
 * advanced; then A = the freshly halved delta and carry = the accumulate carry into the next stage.
 * Returns early (the original's RTS) with only the coordinate written when `$86` is negative. [code]
 * @param {number} [a] incoming delta byte
 * @param {boolean} [carryIn] incoming carry
 */
export function loc_2aeb(m, a = m.regs.a, carryIn = m.regs.fC) {
  const { mem8 } = m;
  // Fold the incoming (already-halved) delta plus the carry-in into the current $63 coordinate.
  // This is the fractional integration step: 8-bit wrap (u8) mirrors the 6502 ADC, and $8b keeps
  // the raw pre-clamp sum so a later stage can read the running total.
  const acc = u8(a + mem8[loc_63] + (carryIn ? 1 : 0));
  mem8[loc_8b] = acc;
  // Collision gate: resolve the tilemap cell the object is trying to occupy -- its own $73 column,
  // top row (0x00). A nonzero cell means a mushroom/wall is already there.
  const [cell] = resolveTileCellAtXY(m, mem8[loc_73], 0x00);
  let clamped;
  // Decide the coordinate to commit. Occupied -> reject the move; empty -> admit the new sum but
  // clamp it into the on-field band [$0b, $f4] so the object never crosses the playfield rails.
  if (cell !== 0) {
    clamped = mem8[loc_63];                       // occupied cell -> keep $63
  } else if (acc >= 0xf4) {
    clamped = 0xf4;
  } else if (acc >= 0x0b) {
    clamped = acc;
  } else {
    clamped = 0x0b;
  }
  mem8[loc_63] = clamped;
  // Master enable check (same as the $63 stage): a negative $86 disables movement, so the routine
  // stops here with only the coordinate updated -- the original returns via RTS at this point.
  if (mem8[loc_86] & 0x80) return;                // enable negative -> RTS
  // Consume the $bb source delta: read it, zero the cell, then negate (two's-complement) the old
  // value. Zeroing $bb marks the delta as spent so the next frame starts from a clean slate.
  const oldBb = mem8[loc_bb];
  mem8[loc_bb] = 0x00;
  const neg = negateA(m, oldBb);
  // Halve the negated delta toward the rails (sign-preserving >>1) and accumulate the halved
  // magnitude into the $73-axis sub-step accumulator $85. The >0xff test recovers the ADC carry.
  const [aClamp, halvedY] = clampAndHalveSignedDelta(m, neg);
  const sum = aClamp + mem8[MOVE_SUBSTEP_ACCUM_B];
  mem8[MOVE_SUBSTEP_ACCUM_B] = u8(sum);
  // Fall through into the next stage: A = halved delta, carry = the accumulate carry.
  return clampCoordToBand(m, halvedY, sum > 0xff);
}
