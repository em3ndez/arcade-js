// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SEG_DIRECTION } from "./names.js";

/**
 * lookupRingHeading — read a climber's heading from the ring-direction table. ROM 0x9ed7.
 *
 * Role in the machine: the tube is a ring of segments, and each segment carries a
 * precomputed heading byte in the direction table ($3ee). An enemy climbing the web needs
 * the heading for the segment it is on; this looks that heading up and hands it back with
 * bit7 forced on (the caller's "valid heading" marker). The caller can also request the
 * opposite side of the ring -- the half-turn -- by setting bit6 of its input value, used
 * when a flipper reverses direction around the tube.
 *
 * Behavior: if the caller's a has bit6 set, first take the half-turn -- step the segment
 * index y back one within the 16-slot ring (y=(y-1)&0x0f) and read that entry, adding 8
 * and re-wrapping into the ring ((table+8)&0x0f). Otherwise read the entry at y straight.
 * Either way the result is OR'd with 0x80 and returned in a.
 *
 * Live-out: a = the heading byte with bit7 set. Grounding: [seen].
 */
export function lookupRingHeading(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  let out;
  if (a & 0x40) {                              // half-turn requested
    y = (y - 1) & 0x0f;                        // step back one within the 16-slot ring
    out = (mem8[u16(SEG_DIRECTION + y)] + 8) & 0x0f;  // opposite-side heading, re-wrapped
  } else {
    out = mem8[u16(SEG_DIRECTION + y)];        // straight lookup at this segment
  }
  return (m.regs.a = out | 0x80);              // bit7 marks a valid heading
}
