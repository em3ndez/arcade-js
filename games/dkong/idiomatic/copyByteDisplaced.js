// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyByteDisplaced — generic addressing primitive: copy the byte at base+index (HL+BC) to
 * base+index+displacement (+DE). Both additions are 16-bit and wrap.
 *
 * LIVE-OUT: memory-only — the one byte written at the displaced address.
 */
export function copyByteDisplaced(m) {
  const { regs, mem8 } = m;

  const src = (regs.hl + regs.bc) & 0xffff;
  const dst = (src + regs.de) & 0xffff;
  mem8[dst] = mem8[src];
}
