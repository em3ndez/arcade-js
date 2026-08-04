// SPDX-License-Identifier: GPL-3.0-only
/**
 * findOppositeLadderEnd — find a key in the ladder (object-parameter) table and hand back the paired
 * slot at the other end of that ladder, tagged with which end the caller started from.
 *
 * Scans OBJ_PARAM_TABLE0 for the first entry whose byte equals the search key, then uses a
 * discriminator to pick which of two slots tied to that entry to hand back. The two slots sit a
 * fixed +0x15 and +0x2A past the matched byte, and the routine returns whichever slot the
 * discriminator did NOT match — the OTHER member of the pair — tagged by which one it was:
 *
 *   discriminator == the byte at match+0x15   ->  tag 1, return the byte at match+0x2A
 *   discriminator == the byte at match+0x2A   ->  tag 0, return the byte at match+0x15
 *   neither slot matched                      ->  keep scanning past this entry
 *   key never found before the count runs out ->  MISS
 *
 * A MISS is a double unwind — the caller must return too. Here that is a `false` return, which each
 * caller mirrors with `if (!findOppositeLadderEnd(m)) return;`.
 *
 * The interface stays REGISTER-SHAPED: the key, the entry count and the discriminator arrive in
 * registers, and the tag, the returned slot byte, the residual count and the key echo leave in
 * registers. That is the hardware's own calling convention and every caller still marshals into it;
 * dissolving the marshalling is one job for the whole group, not for this file alone.
 *
 * WHAT THE NAME CLAIMS, AND WHAT IT CANNOT. What this body derives is the SHAPE: a keyed lookup into
 * a table of records, each carrying a pair of slots at a fixed stride, returning the far one and
 * saying which end it came from. That the records are LADDERS, and that the pair is one ladder's two
 * ends, is NOT derivable here — it rests on evidence from outside this file, and the name carries it
 * rather than proving it.
 *
 * Reads: OBJ_PARAM_TABLE0, and the two paired slots past each match. Writes: no work RAM at all.
 * LIVE-OUT: on a hit, the four register results above, with the discriminator passing through
 * unchanged; on a miss, the false return. The address just past the match is left in a register but
 * no caller reads it, so it is dropped.
 */

import { OBJ_PARAM_TABLE0 } from "./names.js";

// A matched entry carries two paired slots at these fixed offsets past its key byte.
const NEAR_SLOT = 0x15;
const FAR_SLOT = 0x2a;

/**
 * @param {object} m  the machine. Live-in registers: the search key, the entry count,
 *   and the discriminator. Live-out registers on a hit: the tag, the paired slot byte,
 *   the residual-count low byte, and the key echo.
 * @returns {boolean} true on a hit, with the results in registers; false on a miss, on
 *   which the caller must also return — the double unwind.
 */
export function findOppositeLadderEnd(m) {
  const { regs, mem } = m;

  const key = regs.a;      // the byte to find in the table
  const disc = regs.d;     // selects which of the matched entry's two slots to return
  let count = regs.bc;     // how many table bytes may be scanned before giving up
  let addr = OBJ_PARAM_TABLE0;

  for (;;) {
    // Linear forward scan for the key: it steps one past the matched byte and consumes
    // one from the count each step, and a zero count on entry means a full 65536-byte
    // wrap before giving up.
    let found = false;
    do {
      const hit = mem.read8(addr) === key;
      addr = (addr + 1) & 0xffff;
      count = (count - 1) & 0xffff;
      if (hit) { found = true; break; }
    } while (count !== 0);

    if (!found) return false; // key never appeared — unwind on the caller's behalf

    // `addr` now sits one past the matched byte; the two paired slots hang off the match.
    const match = (addr - 1) & 0xffff;
    const nearAddr = (match + NEAR_SLOT) & 0xffff;
    const farAddr = (match + FAR_SLOT) & 0xffff;

    if (disc === mem.read8(nearAddr)) {
      // Discriminator is the near slot -> return the far slot, tagged 1.
      regs.a = 1;
      regs.b = mem.read8(farAddr);
      regs.c = count & 0xff;
      regs.e = key;
      return true;
    }
    if (disc === mem.read8(farAddr)) {
      // Discriminator is the far slot -> return the near slot, tagged 0.
      regs.a = 0;
      regs.b = mem.read8(nearAddr);
      regs.c = count & 0xff;
      regs.e = key;
      return true;
    }
    // Neither slot matched this entry — resume scanning just past it with what is left.
  }
}
