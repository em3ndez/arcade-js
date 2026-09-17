// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFallingBarrel — carry a barrel one frame down its fall and decide whether it may probe
 * the girder underneath. One of the five barrel-dispatcher branches; like its siblings it opens by
 * swapping to the shadow register set (the object loop keeps its cursors there and the shared tail
 * swaps back — dropping the swap corrupts the loop cursor). After the ballistic step it picks one
 * of three continuations: not yet CONTACT_REARM_DISTANCE past the last contact -> end-of-range
 * retirement check; far enough and touching a slope -> contact arm; far enough and no contact ->
 * no-contact arm. The re-arm gate subtracts as a byte, so an OBJ_Y under the distance wraps and
 * passes; that arm is only reached by a crafted entry.
 *
 * LIVE-OUT: the return value only. The residual accumulator and shadow B are dropped.
 */

import { u8 } from "../../../core/int.js";
import { loc_2a2f } from "./loc_2a2f.js"; // the girder/slope probe
import { stepBallisticMotion } from "./stepBallisticMotion.js";

// OBJ_Y at the barrel's last registered contact
const OBJ_CONTACT_Y = 25;
const CONTACT_REARM_DISTANCE = 26;

export function advanceFallingBarrel(m, record = m.regs.ix) {
  const { regs, mem8 } = m;

  regs.exx();

  stepBallisticMotion(m);
  const objectY = regs.h;

  // Byte subtraction: an OBJ_Y under the re-arm distance wraps and passes the gate.
  const lastContactY = mem8[record + OBJ_CONTACT_Y];
  if (u8(objectY - CONTACT_REARM_DISTANCE) < lastContactY) return m.call(0x2104);

  if (loc_2a2f(m)) return m.call(0x2118);
  return m.call(0x2101);
}
