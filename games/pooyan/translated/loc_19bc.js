// SPDX-License-Identifier: GPL-3.0-only

// loc_19bc  (ROM 0x19bc-0x19c9) -- zero-fill work RAM 0x8a80-0x8c7f. Seeds (0x8a80)=0 then
// ldir-propagates it forward (HL=0x8a80, DE=0x8a81, BC=0x01ff) so all 0x200 bytes clear. No calls.
export function loc_19bc(m) {
  const { regs, mem } = m;

  regs.hl = 0x8a80;             m.step(0x19bf, 10);
  regs.de = 0x8a81;             m.step(0x19c2, 10);
  regs.bc = 0x01ff;             m.step(0x19c5, 10);
  mem.write8(regs.hl, 0x00);    m.step(0x19c7, 10); // ld (hl),0x00
  m.ldirAt(0x19c7, 0x19c9);                          // ldir -- fill 0x8a80..0x8c7f with 0

  m.ret(); // 19c9  ret
}
