// SPDX-License-Identifier: GPL-3.0-only
/**
 * findOppositeLadderEnd — scan OBJ_PARAM_TABLE0 for the first entry equal to the search key, then
 * hand back the paired slot at the other end of that ladder, tagged with which end the caller
 * started from. The two slots sit +0x15 and +0x2A past the match; a discriminator picks which one
 * NOT to return. A miss is a double unwind, mirrored by the caller as `if (!...) return;`. The
 * interface stays register-shaped.
 *
 * LIVE-OUT: on a hit, the four register results, discriminator passing through; on a miss, false.
 * The register writes stay load-bearing (a frozen translated caller reads a/b/c/e off them); the
 * return now ALSO carries those outputs as an object so idiomatic callers consume them directly.
 */

import { u16 } from "../../../core/int.js";
import { OBJ_PARAM_TABLE0 } from "./names.js";

const NEAR_SLOT = 0x15;
const FAR_SLOT = 0x2a;

/**
 * @param {object} m  the machine. Live-in registers: search key, entry count, discriminator.
 * @returns {{hit: boolean, a?: number, b?: number, c?: number, e?: number}} `{hit: true}` plus the
 *   four register results (a/b/c/e, mirroring the register writes) on a hit; `{hit: false}` on a
 *   miss. The regs.a/b/c/e writes are kept for the frozen-seam ABI.
 */
export function findOppositeLadderEnd(m, key = m.regs.a, disc = m.regs.d, count = m.regs.bc) {
  const { mem8 } = m;

  let addr = OBJ_PARAM_TABLE0;

  for (;;) {
    // Linear forward scan; a zero count on entry means a full 65536-byte wrap before giving up.
    let found = false;
    do {
      const hit = mem8[addr] === key;
      addr = u16(addr + 1);
      count = u16(count - 1);
      if (hit) { found = true; break; }
    } while (count !== 0);

    if (!found) return { hit: false };

    const match = u16(addr - 1);
    const nearAddr = u16(match + NEAR_SLOT);
    const farAddr = u16(match + FAR_SLOT);

    if (disc === mem8[nearAddr]) {
      const b = mem8[farAddr], c = count & 0xff;
      // Writes ride the return (frozen-seam ABI) so they stay the exempt outgoing form.
      return (m.regs.a = 1, m.regs.b = b, m.regs.c = c, m.regs.e = key, { hit: true, a: 1, b, c, e: key });
    }
    if (disc === mem8[farAddr]) {
      const b = mem8[nearAddr], c = count & 0xff;
      return (m.regs.a = 0, m.regs.b = b, m.regs.c = c, m.regs.e = key, { hit: true, a: 0, b, c, e: key });
    }
    // Neither slot matched — resume scanning past this entry.
  }
}
