// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_43, loc_73, MOVE_SUBSTEP_ACCUM_A, loc_86, loc_8d, loc_b9, loc_fe } from "./names.js";
import { clampAndHalveSignedDelta } from "./clampAndHalveSignedDelta.js";
import { loc_2aeb } from "./loc_2aeb.js";

/**
 * loc_2ace -- gated axis-delta integrator. When the master enable $86 is non-negative and
 * the $43 control bits are clear, snapshot $73 into $8d, swap $b9 with $fe, halve the old
 * $b9 toward the rails, and accumulate the halved magnitude into $84; then fall through into
 * the companion integrator with A = the halved delta and the accumulate carry live. Returns
 * early (seam RTS) when the enable is negative or the control bits are set. [code]
 */
export function loc_2ace(m) {
  const { mem8 } = m;
  if (mem8[loc_86] & 0x80) return;              // enable negative -> RTS
  if ((mem8[loc_43] & 0xaf) !== 0) return;      // control bits set -> RTS
  mem8[loc_8d] = mem8[loc_73];
  const swapped = mem8[loc_fe];
  const oldB9 = mem8[loc_b9];
  mem8[loc_b9] = swapped;
  const [aClamp, halvedY] = clampAndHalveSignedDelta(m, oldB9);
  const sum = aClamp + mem8[MOVE_SUBSTEP_ACCUM_A];
  mem8[MOVE_SUBSTEP_ACCUM_A] = u8(sum);
  // Fall through into the companion integrator: A = halved delta, carry = the accumulate carry.
  return loc_2aeb(m, halvedY, sum > 0xff);
}
