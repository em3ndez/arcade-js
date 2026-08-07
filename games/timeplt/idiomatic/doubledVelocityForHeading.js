// SPDX-License-Identifier: GPL-3.0-only
/** doubledVelocityForHeading — the perpendicular pair the caller's table gives for a heading
 * handed straight in as a value, at TWICE the length the table carries; the doubling wraps at
 * sixteen bits rather than saturating. Which of the pair is the screen's across and which its
 * down is not settled here. LIVE-OUT: the pair; no writes. */

import { u16 } from "../../../core/int.js";
import { velocityForHeading } from "./velocityForHeading.js";

export function doubledVelocityForHeading(m, table = m.regs.hl, heading = m.regs.a) {
  const { regs } = m;
  velocityForHeading(m, table, heading);
  regs.de = u16(2 * regs.de);
  regs.bc = u16(2 * regs.bc);
}
