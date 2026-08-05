// SPDX-License-Identifier: GPL-3.0-only

// loc_200c  (ROM 0x200C–0x200F)
export function loc_200c(m) {
  const { regs } = m;

  regs.addHl(regs.de);
  m.step(0x200d, 11); // add hl,de

  m.push16(0x200e);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.a = regs.b;
  m.step(0x200f, 4); // ld a,b

  m.ret(); // 0x200f
}
