// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_618a } from "./loc_618a.js";
import { loc_0ef1 } from "./loc_0ef1.js";
import { loc_0efd } from "./loc_0efd.js";
import { ACTIVE_OBJECT_TYPE } from "./names.js";
/**
 * loc_6166 — reset an actor record and queue the matching sound, then abort the frame.
 *
 * Clears the record IY points at back to its idle opening state (fields +0/+1/+2 and
 * +0x13/+0x14/+0x16/+0x17), enqueues one of two fixed sound commands chosen by the
 * current object type, then continues into the caller-skip that clears the type and
 * unwinds the frame.
 *
 * LIVE-OUT: none of its own; returns the skip's boolean (always false).
 */
export function loc_6166(m, iy = m.regs.iy) {
  const { mem8 } = m;
  mem8[u16(iy + 0x00)] = 0x00; // idle opening state
  mem8[u16(iy + 0x01)] = 0x01;
  mem8[u16(iy + 0x02)] = 0x08;
  mem8[u16(iy + 0x16)] = 0x07;
  mem8[u16(iy + 0x17)] = 0x05;
  mem8[u16(iy + 0x14)] = 0x00;
  mem8[u16(iy + 0x13)] = 0x00;
  if (mem8[ACTIVE_OBJECT_TYPE] !== 0x03) loc_0ef1(m);
  else loc_0efd(m);
  return loc_618a(m); // clear the object type and abort the frame
}
