// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { foldSignedMagnitude } from "./foldSignedMagnitude.js";
import { loc_2b79, loc_2b86 } from "./loc_2b79.js";
import { loc_72, loc_8d, loc_ef } from "./names.js";

/**
 * routeByCoordDelta -- gate on the signed delta between the $72 coordinate and $8d.
 * The $ef flag inverts which side of the delta bails: it routes to the $72/$62 fixup
 * when ($ef != 0) == (delta >= 0). Otherwise the magnitude of the delta decides --
 * a large gap (>= 5) hands off to the arm-flag tail, a small one falls through to the
 * same fixup. Writes only via the routines it hands off to. [code]
 */
export function routeByCoordDelta(m) {
  const { mem8 } = m;
  const sub = mem8[loc_72] - mem8[loc_8d];
  const noBorrow = sub >= 0; // $72 >= $8d
  if ((mem8[loc_ef] !== 0) === noBorrow) return loc_2b79(m); // fixup side
  const diff = u8(sub);
  const mag = foldSignedMagnitude(m, diff, (diff & 0x80) !== 0);
  if (mag >= 0x05) return loc_2b86(m); // wide gap -> arm-flag tail
  return loc_2b79(m); // narrow gap -> fixup
}
