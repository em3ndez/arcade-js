// SPDX-License-Identifier: GPL-3.0-only

// loc_0f7b  (ROM 0x0F7B-0x0F8C, Time Pilot)
export function loc_0f7b(m) {
  const { regs, mem } = m;

  regs.add(regs.a);
  m.step(0x0f7c, 4); // add a,a

  regs.add(regs.a);
  m.step(0x0f7d, 4); // add a,a -- A = 4*index

  regs.hl = 0x186a;
  m.step(0x0f80, 10); // ld hl,0x186a

  regs.de = 0xa9d3;
  m.step(0x0f83, 10); // ld de,0xa9d3

  m.push16(0x0f84);
  m.step(0x0018, 11); // rst 0x18 -- HL += A (with carry into H)
  m.call(0x0018);

  m.ldi(0x0f86); // 0f84  ldi

  m.ldi(0x0f88); // 0f86  ldi

  m.ldi(0x0f8a); // 0f88  ldi

  m.ldi(0x0f8c); // 0f8a  ldi

  m.ret(); // 0f8c  ret
}
