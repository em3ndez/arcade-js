// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_63, loc_73, MOVE_SUBSTEP_ACCUM_B, loc_86, loc_8b, loc_bb } from "./names.js";
import { clampAndHalveSignedDelta } from "./clampAndHalveSignedDelta.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { negateA } from "./negateA.js";
import { clampCoordToBand } from "./clampCoordToBand.js";

/**
 * loc_2aeb -- companion axis-delta integrator (partner of the $84 stage). Adds A (the halved
 * delta) plus carry into $63 and parks the sum in $8b; when the resolved tile cell at ($73,row0)
 * is empty it clamps that sum into [$0b,$f4], otherwise it reloads $63 unchanged. Returns early
 * (seam RTS) when the enable $86 is negative; else negates $bb, halves it toward the rails,
 * accumulates into $85 and falls through with A = the halved delta and the accumulate carry. [code]
 * @param {number} [a] incoming delta byte
 * @param {boolean} [carryIn] incoming carry
 */
export function loc_2aeb(m, a = m.regs.a, carryIn = m.regs.fC) {
  const { mem8 } = m;
  const acc = u8(a + mem8[loc_63] + (carryIn ? 1 : 0));
  mem8[loc_8b] = acc;
  const [cell] = resolveTileCellAtXY(m, mem8[loc_73], 0x00);
  let clamped;
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
  if (mem8[loc_86] & 0x80) return;                // enable negative -> RTS
  const oldBb = mem8[loc_bb];
  mem8[loc_bb] = 0x00;
  const neg = negateA(m, oldBb);
  const [aClamp, halvedY] = clampAndHalveSignedDelta(m, neg);
  const sum = aClamp + mem8[MOVE_SUBSTEP_ACCUM_B];
  mem8[MOVE_SUBSTEP_ACCUM_B] = u8(sum);
  // Fall through into the next stage: A = halved delta, carry = the accumulate carry.
  return clampCoordToBand(m, halvedY, sum > 0xff);
}
