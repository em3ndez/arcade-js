// SPDX-License-Identifier: GPL-3.0-only

// loc_0bff  (ROM 0x0BFF-0x0C0E)
export function loc_0bff(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x0c00, 7); // 0bff  ld a,(hl)
    regs.cp(0xb9);
    m.step(0x0c02, 7); // 0c00  cp 0xb9

    if (regs.fZ) { m.ret(11); return; } // 0c02  ret z (taken) -- terminator
    m.step(0x0c03, 5); // 0c02  ret z (not taken)

    mem.write8(regs.de, regs.a, 4);
    m.step(0x0c04, 7); // 0c03  ld (de),a -- the glyph, into video RAM
    regs.d = regs.res(2, regs.d); // no flags
    m.step(0x0c06, 8); // 0c04  res 2,d -- same cell in COLOUR RAM
    regs.a = regs.c;
    m.step(0x0c07, 4); // 0c06  ld a,c
    mem.write8(regs.de, regs.a, 4);
    m.step(0x0c08, 7); // 0c07  ld (de),a -- the colour
    regs.d = regs.set(2, regs.d); // no flags
    m.step(0x0c0a, 8); // 0c08  set 2,d -- back to video RAM
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0c0b, 6); // 0c0a  inc hl

    m.push16(0x0c0c);
    m.step(0x0020, 11); // 0c0b  rst 0x20 -- DE -= 0x20, one row
    m.call(0x0020);

    m.step(0x0bff, 10); // 0c0c  jp 0x0bff
  }
}
