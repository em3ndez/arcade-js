// SPDX-License-Identifier: GPL-3.0-only

// Fill 0x37 bytes with 0x01 from HL upward. Live-out: memory; the seam completes the ret.
export function loc_01c3(m, hl = m.regs.hl) {
  for (let i = 0; i < 0x37; i++) m.mem8[hl + i] = 0x01;
}
