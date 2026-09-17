// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearStridedBytes — zero B bytes at stride 4, walking the LOW address byte only so the
 * clear wraps within the current 256-byte page and never carries into the high byte.
 *
 * LIVE-OUT: memory (the B bytes, each 0x00) + A = final low byte (L + 4*B) & 0xFF,
 * HL = the page carrying it (high byte preserved), B = 0. Flags not reproduced.
 */
export function clearStridedBytes(m, hl = m.regs.hl, b = m.regs.b) {
  const { regs, mem8 } = m;

  const page = hl & 0xff00;
  let lo = hl & 0xff;
  const count = b === 0 ? 256 : b; // B == 0 means 256 passes, not zero

  for (let i = 0; i < count; i++) {
    mem8[page | lo] = 0x00;
    lo = (lo + 4) & 0xff; // low byte only, wraps within the page
  }

  regs.a = lo;
  regs.hl = page | lo;
  regs.b = 0;
}
