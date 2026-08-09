// SPDX-License-Identifier: GPL-3.0-only
/** loc_0f8d — the image-checksum tamper trap: pop four return words to unwind the caller chain, then
 * fall into the sprite fixup pass. LIVE-OUT: sp past the four words, the fourth's flags, b=2/c, the pass. */

import { multiplexSpriteSlotsSkipping as spriteFixupPass } from "./multiplexSpriteSlotsSkipping.js";

const DISCARDED_WORDS = 4;
const BC_RESIDUE = 0x02f2;

export function loc_0f8d(m) {
  const { regs } = m;
  for (let i = 0; i < DISCARDED_WORDS; i++) regs.af = m.pop16();
  regs.bc = BC_RESIDUE;
  return spriteFixupPass(m);
}
