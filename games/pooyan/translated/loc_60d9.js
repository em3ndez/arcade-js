// SPDX-License-Identifier: GPL-3.0-only

// loc_60d9  (ROM 0x60d9-0x60f1) -- entry (fall-through from the 0x60d5 chunk). Pick actor slot
// 0x8d1c, or 0x8d1b when I==0 (`ld a,i` parity), mark (slot+0)=1, init a fresh record at HL via
// loc_619f (DE=0x0404), then set DE=0xfffd and tail-jump the scan continuation 0x611f (boundary).
export function loc_60d9(m) {
  const { regs, mem } = m;

  regs.iy = 0x8d1c;                          m.step(0x60dd, 14);
  regs.ldAI();                               m.step(0x60df, 9);  // A<-I, Z when I==0
  if (regs.fNZ) {
    m.step(0x60e3, 12);                       // jr nz taken -- keep slot 0x8d1c
  } else {
    m.step(0x60e1, 7);                        // jr nz not taken
    regs.iy = (regs.iy - 1) & 0xffff;         m.step(0x60e3, 10); // dec iy -> 0x8d1b
  }
  mem.write8((regs.iy + 0x00) & 0xffff, 0x01); m.step(0x60e7, 19);
  regs.de = 0x0404;                          m.step(0x60ea, 10);
  m.push16(0x60ed);
  m.step(0x619f, 17);                         // 60ea  call 0x619f (init record at HL)
  m.call(0x619f);
  regs.de = 0xfffd;                          m.step(0x60f0, 10);
  m.step(0x611f, 12);                         // 60f0  jr 0x611f (tail -> boundary)
  return m.call(0x611f);
}
