// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { foldSignedMagnitude } from "./foldSignedMagnitude.js";
import { armSlotState } from "./armSlotState.js";
import { enterArmBlockUnlessValueHigh } from "./enterArmBlockUnlessValueHigh.js";
import { loc_54, loc_63, loc_64, loc_73, loc_8d } from "./names.js";

/**
 * armSlotWhenObjectInRange -- measure object X's distance from the reference point
 * ($63,$73) and arm its slot only when it sits inside the range box. |dx| = |$54,X - $63|
 * must clear its bound (0x0a for slot 0x0d, else 0x07) and |dy| = |$64,X - $73| must
 * clear 0x07, else it bails with no change. On success it stashes |dx| in $8d and passes
 * the summed distance to the slot arm: slot 0x0d takes the value-gated entry, every other
 * slot arms unless the sum is high (carry = sum >= 0x0c). [code]
 */
export function armSlotWhenObjectInRange(m, x = m.regs.x) {
  const { mem8 } = m;
  const dxRaw = u8(mem8[(loc_54 + x) & 0xff] - mem8[loc_63]);
  const dxMag = foldSignedMagnitude(m, dxRaw, (dxRaw & 0x80) !== 0);
  const dxBound = x === 0x0d ? 0x0a : 0x07;
  if (dxMag >= dxBound) return (m.regs.fC = true); // out of horizontal range -> C=1
  mem8[loc_8d] = dxMag;
  const dyRaw = u8(mem8[(loc_64 + x) & 0xff] - mem8[loc_73]);
  const dyMag = foldSignedMagnitude(m, dyRaw, (dyRaw & 0x80) !== 0);
  if (dyMag >= 0x07) return (m.regs.fC = true); // out of vertical range -> C=1
  const sum = u8(dyMag + dxMag);
  // Arm delegates do the writes and return carry-CLEAR (false) when they arm; on their no-op path they
  // return undefined and preserve the entry carry (SET). Re-expose that exit carry as our dispatch-out.
  if (x === 0x0d) {
    const armed = enterArmBlockUnlessValueHigh(m, sum, x);
    return (m.regs.fC = armed === undefined ? true : armed);
  }
  const armed = armSlotState(m, x, sum >= 0x0c);
  return (m.regs.fC = armed === undefined ? true : armed);
}
