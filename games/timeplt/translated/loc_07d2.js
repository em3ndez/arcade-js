// SPDX-License-Identifier: GPL-3.0-only

// loc_07d2  (ROM 0x07D2–0x07E5)
export function loc_07d2(m) {
  const { regs, mem } = m;

  regs.hl = 0xa79f;
  m.step(0x07d5, 10); // ld hl,0xa79f
  regs.de = 0xffe0; // -0x20, one row back
  m.step(0x07d8, 10); // ld de,0xffe0
  regs.b = 0x0e;
  m.step(0x07da, 7); // ld b,0x0e

  do {
    mem.write8(regs.hl, 0xf1); // video RAM cell
    m.step(0x07dc, 10); // ld (hl),0xf1
    regs.h = regs.res(2, regs.h); // 0xA7xx -> 0xA3xx, same cell offset
    m.step(0x07de, 8); // res 2,h
    mem.write8(regs.hl, 0x16); // colour RAM cell
    m.step(0x07e0, 10); // ld (hl),0x16
    regs.h = regs.set(2, regs.h); // back to video RAM
    m.step(0x07e2, 8); // set 2,h
    regs.addHl(regs.de);
    m.step(0x07e3, 11); // add hl,de
    regs.djnz(); // no flags
    m.step(regs.b !== 0 ? 0x07da : 0x07e5, regs.b !== 0 ? 13 : 8); // djnz 0x07da
  } while (regs.b !== 0);

  m.ret(); // 07e5
}
