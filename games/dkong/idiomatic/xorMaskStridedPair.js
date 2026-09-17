// SPDX-License-Identifier: GPL-3.0-only
/**
 * xorMaskStridedPair — XOR the caller's mask (regs.c) into two bytes a fixed distance apart:
 * read-modify-write at HL, step by the caller's stride (regs.de), repeat once. Count is fixed
 * at two; the stride is inherited, not reloaded here.
 *
 * LIVE-OUT: memory-only — the two toggled bytes. The register file is left alone.
 */
export function xorMaskStridedPair(m) {
  const { regs, mem8 } = m;

  const mask = regs.c;
  const stride = regs.de;

  let ptr = regs.hl;
  for (let i = 0; i < 2; i++) {
    mem8[ptr] = mem8[ptr] ^ mask;
    ptr = (ptr + stride) & 0xffff;
  }
}
