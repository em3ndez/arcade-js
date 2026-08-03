// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_236e — find a key in the object-parameter table and return its paired slot.  ROM 0x236E.
 *
 * Scans the type-0 object table for the first entry whose byte equals the search
 * key, then uses a discriminator to pick which of two slots tied to that entry to
 * hand back. The two slots sit a fixed 0x15 and 0x2A past the matched byte, and the
 * routine returns whichever slot the discriminator did NOT match — the *other* member
 * of the pair — tagged by which one that was:
 *
 *   discriminator == byte at (match + 0x15)  ->  tag 1, return byte at (match + 0x2A)
 *   discriminator == byte at (match + 0x2A)  ->  tag 0, return byte at (match + 0x15)
 *   neither slot matched                     ->  keep scanning past this entry
 *   key not found before the count runs out  ->  MISS: unwind (return false)
 *
 * The miss is a double unwind in the oracle — it drops its own return address and
 * returns on the caller's behalf. Here that is a `false` return; each caller mirrors
 * it with `if (!loc_236e(m)) return;`, so the caller unwinds too.
 *
 * This is a genuine oracle boundary: its three callers are still the frozen lift and
 * reach it by register ABI, so the interface stays register-shaped — the key, the
 * entry count, and the discriminator arrive in registers, and the found result (the
 * tag, the returned slot byte, the residual count, and the key echo) leaves in
 * registers, exactly as those callers consume it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-236e.test.js.
 * GATE:     crafted-entry (a controlled table planted in a real attract base) covering
 *           both found tags, the multi-entry rescan, and the not-found miss, plus real
 *           captured dispatches; 0x236E is a gameplay object-lookup driven from
 *           climb/collision code and runs during the attract demo.
 * LIVE-OUT: registers, found path only — the tag, the paired slot byte, the low byte of
 *           the residual scan count, and the echoed key; the discriminator passes through
 *           unchanged. (The address past the match is left in a register by the oracle but
 *           no caller reads it — dead, so it is dropped.) The boolean return is the
 *           miss/found signal. Writes no work RAM (the oracle's stack churn is dead).
 * NAMES:    OBJ_PARAM_TABLE0 (0x6300) from ram.js — the scan base. The +0x15 / +0x2A slot
 *           offsets are structural strides within a table record and stay literal.
 */

import { OBJ_PARAM_TABLE0 } from "./ram.js";

// A matched entry carries two paired slots at these fixed offsets past its key byte.
const NEAR_SLOT = 0x15;
const FAR_SLOT = 0x2a;

/**
 * @param {object} m  the machine. Live-in registers: the search key, the entry count,
 *   and the discriminator. Live-out registers on a hit: the tag, the paired slot byte,
 *   the residual-count low byte, and the key echo.
 * @returns {boolean} true on a hit (registers hold the result); false on a miss, on
 *   which the caller must also return (the oracle's double unwind).
 */
export function loc_236e(m) {
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
