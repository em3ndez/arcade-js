// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4c1c — zero a fixed 64-byte work-RAM block during setup.  ROM 0x4c1c.
 *
 * Fills work RAM 0x8200 through 0x823f (64 bytes) with zero in a single pass — a
 * one-shot wipe of that block reached from the board/entry-select setup. The top
 * half, 0x8220..0x823f, is the 32-byte sprite-record staging buffer that the game
 * later block-copies into hardware sprite RAM; wiping it leaves that buffer (and
 * the 32 bytes below it) blank until the next record is staged. A sibling wipe
 * clears the actual hardware attribute/sprite RAM.
 *
 * The block base and length are baked into the code, so the clear always covers
 * exactly the same 64 bytes no matter what is in memory or the registers on entry.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c1c.test.js.
 * GATE:     crafted-entry (a dirtied block proves the writes) + real captured
 *           dispatches; entered a handful of times during boot/attract, first ~frame 2.
 * LIVE-OUT: memory-only — the 64 zeroed bytes. The oracle's exit registers, flags,
 *           and Z80 return path (SP/PC) are dead scratch a plain JS return replaces.
 * NAMES:    none — the 0x8200 block has no confirmed ram.js role, so the base
 *           address is kept literal rather than given an unearned name.
 */
export function loc_4c1c(m) {
  const { mem8 } = m;
  // Zero every byte of the 64-byte block [0x8200, 0x8240).
  for (let addr = 0x8200; addr < 0x8240; addr++) {
    mem8[addr] = 0;
  }
}
