// SPDX-License-Identifier: GPL-3.0-only

// loc_2a47  (ROM 0x2A47–0x2A56)
export function loc_2a47(m) {
  const { regs, mem } = m;

  m.push16(0x2a4a);
  m.step(0x2a57, 17); // call 0x2a57 -- leaves the pair in B and C
  m.call(0x2a57);

  regs.a = regs.c;
  m.step(0x2a4b, 4); // ld a,c
  regs.add(0x35);
  m.step(0x2a4d, 7); // add a,0x35
  mem.write8((regs.iy + 0x30) & 0xffff, regs.a);
  m.step(0x2a50, 19); // ld (iy+0x30),a

  regs.a = regs.b;
  m.step(0x2a51, 4); // ld a,b
  regs.add(0x10);
  m.step(0x2a53, 7); // add a,0x10
  mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
  m.step(0x2a56, 19); // ld (iy+0x01),a

  m.ret(10); // ret (0x2A56)
}
