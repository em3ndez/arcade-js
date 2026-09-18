// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSpriteStagingBuffer — zero a fixed 64-byte work-RAM block during setup.
 *
 * Fills a fixed 64-byte block with zero in a single pass — a one-shot wipe reached from the
 * board/entry-select setup. The top half is the sprite-record staging buffer the game later
 * block-copies into hardware sprite RAM; wiping it leaves that buffer (and the bytes below it)
 * blank until the next record is staged. The base and length are baked into the code, so the
 * clear always covers the same 64 bytes regardless of memory or register state on entry.
 */
export function clearSpriteStagingBuffer(m) {
  const { mem8 } = m;
  // Zero every byte of the fixed 64-byte block.
  for (let addr = 0x8200; addr < 0x8240; addr++) {
    mem8[addr] = 0;
  }
}
