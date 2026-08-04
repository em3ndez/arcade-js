// SPDX-License-Identifier: GPL-3.0-only
/**
 * xorMaskStridedPair — toggle the same bit pattern in two bytes a fixed distance apart.
 *
 * A tiny read-modify-write primitive. It reads a byte, XORs the caller's mask into it,
 * writes it back, steps forward by the caller's stride and does it once more. The
 * count is fixed at two. Because it XORs rather than stores, it flips exactly the bits
 * the mask selects and leaves the rest of each byte alone — so running it twice on the
 * same pair restores them.
 *
 * THREE VALUES COME FROM THE CALLER and none of them is set here: the address of the
 * first byte, the mask, and the stride between the two bytes. The stride in particular
 * is inherited — nothing on the way in reloads it — so a caller that has not set it
 * gets whatever the last routine to touch it left behind.
 *
 * A leaf: it calls nothing and touches no named game cell.
 *
 * LIVE-OUT: memory-only — the two toggled bytes. The register file is left alone.
 */
export function xorMaskStridedPair(m) {
  const { regs, mem } = m;

  const mask = regs.c; // the caller's XOR mask; never modified
  const stride = regs.de; // bytes between the two targets

  let ptr = regs.hl;
  for (let i = 0; i < 2; i++) {
    // Toggle the bits the mask selects in the byte that is already there — a
    // read-modify-write, not a store of the mask.
    mem.write8(ptr, mem.read8(ptr) ^ mask);
    ptr = (ptr + stride) & 0xffff; // step to the second target (16-bit wrap)
  }
}
