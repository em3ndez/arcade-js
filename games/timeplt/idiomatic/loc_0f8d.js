// SPDX-License-Identifier: GPL-3.0-only
/** loc_0f8d — the image-checksum tamper trap: pop four return words to unwind the caller chain, then
 * run the sprite fixup pass (the fourth word's low byte carries into it) and return through a fifth.
 * LIVE-OUT: sp past all five words, pc from the fifth, b=2, and the accumulator/C/flags the pass leaves. */

import { multiplexSpriteSlotsSkipping as spriteFixupPass } from "./multiplexSpriteSlotsSkipping.js";

const RESIDUE_LOW = 0xf2; // C the fixup pass reads
const RESIDUE_HIGH = 0x02; // B left for the caller after the pass

export function loc_0f8d(m) {
  m.pop16();
  m.pop16();
  m.pop16();
  const fourth = m.pop16();
  spriteFixupPass(m, RESIDUE_LOW, fourth & 0xff);
  m.ret();
  return void (m.regs.b = RESIDUE_HIGH);
}
