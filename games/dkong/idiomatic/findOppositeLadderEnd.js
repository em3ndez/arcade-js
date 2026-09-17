// SPDX-License-Identifier: GPL-3.0-only
/**
 * findOppositeLadderEnd — scan OBJ_PARAM_TABLE0 for the first entry equal to the search key, then
 * hand back the paired slot at the other end of that ladder, tagged with which end the caller
 * started from. The two slots sit +0x15 and +0x2A past the match; a discriminator picks which one
 * NOT to return. A miss is a double unwind, mirrored by the caller as `if (!...) return;`. The
 * interface stays register-shaped.
 *
 * LIVE-OUT: on a hit, the four register results, discriminator passing through; on a miss, false.
 */

import { OBJ_PARAM_TABLE0 } from "./names.js";

const NEAR_SLOT = 0x15;
const FAR_SLOT = 0x2a;

/**
 * @param {object} m  the machine. Live-in registers: search key, entry count, discriminator.
 * @returns {boolean} true on a hit (results in registers); false on a miss.
 */
export function findOppositeLadderEnd(m) {
  const { regs, mem8 } = m;

  const key = regs.a;
  const disc = regs.d;
  let count = regs.bc;
  let addr = OBJ_PARAM_TABLE0;

  for (;;) {
    // Linear forward scan; a zero count on entry means a full 65536-byte wrap before giving up.
    let found = false;
    do {
      const hit = mem8[addr] === key;
      addr = (addr + 1) & 0xffff;
      count = (count - 1) & 0xffff;
      if (hit) { found = true; break; }
    } while (count !== 0);

    if (!found) return false;

    const match = (addr - 1) & 0xffff;
    const nearAddr = (match + NEAR_SLOT) & 0xffff;
    const farAddr = (match + FAR_SLOT) & 0xffff;

    if (disc === mem8[nearAddr]) {
      regs.a = 1;
      regs.b = mem8[farAddr];
      regs.c = count & 0xff;
      regs.e = key;
      return true;
    }
    if (disc === mem8[farAddr]) {
      regs.a = 0;
      regs.b = mem8[nearAddr];
      regs.c = count & 0xff;
      regs.e = key;
      return true;
    }
    // Neither slot matched — resume scanning past this entry.
  }
}
