// SPDX-License-Identifier: GPL-3.0-only
/** loc_0f8d — the image-checksum tamper trap: pop four return words to unwind the caller chain, then
 * fall into the sprite fixup pass. LIVE-OUT: sp past the four words, the fourth's flags carry into
 * the pass, b=2, and the accumulator/C/flags the pass itself leaves. */

import { multiplexSpriteSlotsSkipping as spriteFixupPass } from "./multiplexSpriteSlotsSkipping.js";

const RESIDUE_LOW = 0xf2; // C the fixup pass reads
const RESIDUE_HIGH = 0x02; // B left for the caller after the pass

export function loc_0f8d(m) {
  m.pop16();
  m.pop16();
  m.pop16();
  const fourth = m.pop16();
  const fixed = spriteFixupPass(m, RESIDUE_LOW, fourth & 0xff);
  return (m.regs.b = RESIDUE_HIGH, fixed);
}
