// SPDX-License-Identifier: GPL-3.0-only

// loc_2a3c  (ROM 0x2A3C-0x2A46, Time Pilot)
export function loc_2a3c(m) {
  const { regs, mem } = m;
  const Y = (d) => (regs.iy + d) & 0xffff;

  m.push16(0x2a3f);
  m.step(0x2a57, 17); // call 0x2a57
  m.call(0x2a57);

  mem.write8(Y(0x30), regs.c);
  m.step(0x2a42, 19); // ld (iy+0x30),c

  regs.a = regs.b;
  m.step(0x2a43, 4); // ld a,b

  mem.write8(Y(0x01), regs.a);
  m.step(0x2a46, 19); // ld (iy+0x01),a

  m.ret(); // 2a46  ret
}
