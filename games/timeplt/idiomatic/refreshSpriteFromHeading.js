// SPDX-License-Identifier: GPL-3.0-only
/** refreshSpriteFromHeading — refresh one object's sprite entry from the way it is heading: take
 * the shape and the byte that mirrors it, and store the pair into the entry's two slots. Choosing
 * the pair is not done here; all this adds is where the two bytes land, and it overwrites both
 * slots whole, so whatever the entry carried before — mirroring and tint together — is replaced.
 * LIVE-OUT: the two slots written, plus the shape left standing in the accumulator. */

import { u16 } from "../../../core/int.js";
import { spriteForHeading } from "./spriteForHeading.js";

const SHAPE_SLOT = 0x01;
const ATTRIBUTE_SLOT = 0x30;

export function refreshSpriteFromHeading(m, entry = m.regs.iy) {
  const { regs, mem8 } = m;
  spriteForHeading(m);
  mem8[u16(entry + ATTRIBUTE_SLOT)] = regs.c;
  regs.a = regs.b;
  mem8[u16(entry + SHAPE_SLOT)] = regs.a;
}
