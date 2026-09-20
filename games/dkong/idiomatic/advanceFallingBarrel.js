// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFallingBarrel — carry a barrel one frame down its fall and decide whether it may probe
 * the girder underneath. One of five barrel-dispatcher branches; opens by swapping to the shadow
 * register set (the object loop keeps its cursors there; dropping the swap corrupts the cursor).
 * After the ballistic step it picks one of three continuations by distance past the last contact.
 * The re-arm gate subtracts as a byte, so an OBJ_Y under the distance wraps and passes.
 * LIVE-OUT: the return value only.
 */

import { retireBarrelAtEndOfRange } from "./retireBarrelAtEndOfRange.js";
import { u8 } from "../../../core/int.js";
import { loc_2a2f } from "./loc_2a2f.js"; // the girder/slope probe
import { stepBallisticMotion } from "./stepBallisticMotion.js";

// OBJ_Y at the barrel's last registered contact
const OBJ_CONTACT_Y = 25;
const CONTACT_REARM_DISTANCE = 26;

export function advanceFallingBarrel(m, record = m.regs.ix) {
  const { mem8 } = m;

  m.regs.exx();

  // stepBallisticMotion returns [newB>>8, newB&0xff]; the high byte is the object Y.
  const [objectY] = stepBallisticMotion(m);

  // Byte subtraction: an OBJ_Y under the re-arm distance wraps and passes the gate.
  const lastContactY = mem8[record + OBJ_CONTACT_Y];
  if (u8(objectY - CONTACT_REARM_DISTANCE) < lastContactY) return retireBarrelAtEndOfRange(m);

  if (loc_2a2f(m)) return m.call(0x2118);
  return m.call(0x2101);
}
