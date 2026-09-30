// SPDX-License-Identifier: GPL-3.0-only
/** refreshSpriteFromHeading — refresh one object's sprite entry from the way it is heading: take
 * the shape and the byte that mirrors it, and store the pair into the entry's two slots. Choosing
 * the pair is not done here; all this adds is where the two bytes land, and it overwrites both
 * slots whole, so whatever the entry carried before — mirroring and tint together — is replaced.
 * The object whose heading is read comes in beside the entry. LIVE-OUT: the two slots written,
 * plus the shape left standing in the accumulator.
 *
 * ROM 0x2A3C-0x2A46 (frozen lift translated/loc_2a3c.js). Grounding: [seen] (names.js ROUTINES
 * 0x2a3c). Role in the machine: one of the two consumers of spriteForHeading; the other is
 * refreshSecondEraSpriteFromHeading (0x2A47), which stores the same pair shifted into era 1's own
 * shape bank and colour. Under MAME this entry ran in driven play and never in an undriven run,
 * so what it dresses is not on screen in attract (names.js).
 *
 * `entry` is the sprite entry (IY) to dress; `object` is the record (IX) whose heading is read.
 */

import { u16 } from "../../../core/int.js";
import { spriteForHeading } from "./spriteForHeading.js";

// The two slots of a sprite entry this fills: +0x01 the shape (tile code), +0x30 the attribute
// byte. The same entry's +0x00 and +0x31 are its coordinates, written by the flight helpers.
const SHAPE_SLOT = 0x01;
const ATTRIBUTE_SLOT = 0x30;

export function refreshSpriteFromHeading(m, entry = m.regs.iy, object = m.regs.ix) {
  const { mem8 } = m;
  /* `call 0x2a57`: spriteForHeading [seen] picks the shape and its mirroring attribute for the
   * object's heading, alternating between two shape banks as a frame counter's bit turns over. */
  const [shape, mirror] = spriteForHeading(m, object);
  /* Store the pair as returned — `ld (iy+0x30),c`, then `ld a,b / ld (iy+0x01),a`. No bias is
   * added here, unlike the era-1 sibling. */
  mem8[u16(entry + ATTRIBUTE_SLOT)] = mirror;
  mem8[u16(entry + SHAPE_SLOT)] = shape;
  /* The ROM's `ld a,b` leaves the shape in A on return, so it is handed back as well. */
  return (m.regs.a = shape);
}
