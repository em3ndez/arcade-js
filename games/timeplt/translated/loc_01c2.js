// SPDX-License-Identifier: GPL-3.0-only

// loc_01c2  (ROM 0x01C2–0x01E0)
export function loc_01c2(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0xa989);
  m.step(0x01c5, 16); // ld hl,(0xa989)
  regs.b = 0x20;
  m.step(0x01c7, 7); // ld b,0x20
  regs.de = 0x0020;
  m.step(0x01ca, 10); // ld de,0x0020

  do {
    mem.write8(regs.hl, 0xf1);
    m.step(0x01cc, 10); // ld (hl),0xf1
    regs.h = regs.res(2, regs.h); // no flags
    m.step(0x01ce, 8); // res 2,h
    mem.write8(regs.hl, 0x10);
    m.step(0x01d0, 10); // ld (hl),0x10
    regs.h = regs.set(2, regs.h); // no flags
    m.step(0x01d2, 8); // set 2,h
    regs.addHl(regs.de);
    m.step(0x01d3, 11); // add hl,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x01ca : 0x01d5, regs.b !== 0 ? 13 : 8); // djnz 0x01ca
  } while (regs.b !== 0);

  regs.hl = mem.read16(0xa989);
  m.step(0x01d8, 16); // ld hl,(0xa989)
  regs.hl = (regs.hl + 1) & 0xffff; // inc hl -- 16-bit, no flags
  m.step(0x01d9, 6); // inc hl
  mem.write16(0xa989, regs.hl);
  m.step(0x01dc, 16); // ld (0xa989),hl
  regs.hl = 0xa988;
  m.step(0x01df, 10); // ld hl,0xa988
  regs.decMem8(mem, regs.hl); // dec (hl) -- sets S/Z/H/PV/N, leaves C
  m.step(0x01e0, 11); // dec (hl)
  m.ret(); // 0x01e0
}
