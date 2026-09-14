// SPDX-License-Identifier: GPL-3.0-only
import { loc_2a, TUBE_GEOM_FLAG } from "./names.js";

/**
 * signedSegmentDelta -- shared signed segment-distance helper. ROM 0xa7a6.
 *
 * Role in the machine: the tube is a ring of segments; several callers (spinner auto-aim, enemy
 * facing) need the signed distance from one segment to another. This computes A minus Y and returns
 * it either as a full signed byte or as a sign-extended low nibble depending on a geometry flag, so
 * open (16-lane) and closed (nibble-wrapped) tubes both yield a correct signed delta.
 *
 * Behavior: it computes a = (A - Y) & 0xff and stashes the raw difference in loc_2a. If TUBE_GEOM_FLAG
 * has bit7 set it returns the full difference; otherwise it masks to the low nibble and, when bit3 is
 * set, sign-extends (| 0xf8) into a signed byte. The result is written back to the A register and
 * returned.
 *
 * Live-out: loc_2a (the stashed raw difference) and the A register (the signed delta the caller reads
 * back). Grounding: [seen].
 */
export function signedSegmentDelta(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  a = (a - y) & 0xff;
  mem8[loc_2a] = a;            // stash the difference
  if (mem8[TUBE_GEOM_FLAG] & 0x80) {  // flag high bit set -> keep the full difference
    return (m.regs.a = a);
  }
  a &= 0x0f;                   // else take the low nibble
  if (a & 0x08) a |= 0xf8;     // sign-extend the nibble into a signed byte
  return (m.regs.a = a);
}
