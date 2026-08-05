// SPDX-License-Identifier: GPL-3.0-only

// loc_07b1  (ROM 0x07B1-0x07D1)
export function loc_07b1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6000); // unmapped -> 0xFF
  m.step(0x07b4, 13); // ld a,(0x6000)
  regs.cp(0x55);
  m.step(0x07b6, 7); // cp 0x55

  if (regs.fZ) {
    m.step(0x6000, 10); // jp z,0x6000
    throw new Error(
      "Time Pilot reset: 0x6000 answered 0x55, so an expansion ROM is mapped. This board " +
      "model has none, and a stock dump never takes this branch.",
    );
  }
  m.step(0x07b9, 10); // jp z not taken

  regs.sp = 0xb000;
  m.step(0x07bc, 10); // ld sp,0xb000
  mem.write8(0xc200, regs.a, 10); // watchdog kick -- the address is the device
  m.step(0x07bf, 13); // ld (0xc200),a
  regs.hl = 0xc300;
  m.step(0x07c2, 10); // ld hl,0xc300
  regs.b = 0x08;
  m.step(0x07c4, 7); // ld b,0x08

  for (;;) {
    mem.write8(regs.hl, 0x00, 7);
    m.step(0x07c6, 10); // ld (hl),0x00
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x07c7, 6); // inc hl
    regs.b = (regs.b - 1) & 0xff;
    if (regs.b !== 0) {
      m.step(0x07c4, 13); // djnz (taken)
      continue;
    }
    m.step(0x07c9, 8); // djnz (not taken)
    break;
  }

  regs.a = mem.read8(0x2d4b);
  m.step(0x07cc, 13); // ld a,(0x2d4b)
  mem.write8(0xc308, regs.a, 10); // LS259 bit 4 -- video enable
  m.step(0x07cf, 13); // ld (0xc308),a

  m.step(0x0069, 10); // jp 0x0069
  return m.call(0x0069);
}
