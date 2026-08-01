// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c72 — set the top bit of engine-scratch byte 0x6382, preserving the low bits.  ROM 0x2C72.
 *
 * A one-line leaf: read the shared engine-scratch byte, turn its high bit on, and store
 * it back. The bits underneath are left alone — the small slot value (0/1/2) the object-slot
 * allocator cluster at 0x2C41 / 0x2C4B / 0x2C4F writes to this same byte survives untouched,
 * so this only raises the top-bit flag without disturbing the value beneath it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c72.test.js.
 * GATE:     exhaustive — sweeps all 256 possible starting byte values (the routine's ENTIRE
 *           input space, so the sweep is a proof) + real captured 0x2C72 dispatches from attract.
 * LIVE-OUT: memory-only — the byte at 0x6382. The oracle carries the value out through the
 *           accumulator, but no caller reads a register from it (its callers tail-jump or return
 *           and reload), so only the stored byte is live.
 * NAMES:    none — 0x6382 is an UNNAMED, shared engine-scratch byte (rejected in ram.js under
 *           "0x63xx engine scratch"), so it stays hex + comment. It is work RAM, not video RAM.
 */

export function loc_2c72(m) {
  const { mem } = m;

  // Raise the top-bit flag on the shared engine-scratch byte, leaving the low bits as they are.
  mem.write8(0x6382, mem.read8(0x6382) | 0x80);
}
