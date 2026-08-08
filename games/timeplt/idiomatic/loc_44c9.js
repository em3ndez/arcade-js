// SPDX-License-Identifier: GPL-3.0-only
/** loc_44c9 — close out one object's animation and dress its sprite entry. The counter the caller
 * carries is read without the top bit that selected this path; once what is left has reached three
 * the counter cell in the object's record is put back to zero, and below three it is left alone.
 * Either way both attribute slots of the sprite entry take the one code fixed here, and the two
 * shape codes are then chosen by the flutter this hands on to.
 * LIVE-OUT: memory — the counter cell, the two attributes, and the pair of shapes. */

import { u16 } from "../../../core/int.js";
import { loc_44dc } from "./loc_44dc.js";

const SELECTOR_BIT = 0x80;
const RESTART_AT = 3;
const COUNTER_SLOT = 6;
const ATTRIBUTE_SLOTS = [0x30, 0x32];
const ATTRIBUTE = 0x51;

export function loc_44c9(m, counter = m.regs.c, record = m.regs.ix, sprite = m.regs.iy) {
  const { mem8 } = m;
  if ((counter & ~SELECTOR_BIT) >= RESTART_AT) mem8[u16(record + COUNTER_SLOT)] = 0;
  for (const slot of ATTRIBUTE_SLOTS) mem8[u16(sprite + slot)] = ATTRIBUTE;
  return loc_44dc(m, sprite);
}
