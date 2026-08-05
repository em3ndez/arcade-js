// SPDX-License-Identifier: GPL-3.0-only

// loc_1226  (ROM 0x1226-0x123A, Time Pilot)
export function loc_1226(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad32);
  m.step(0x1229, 13); // ld a,(0xad32)
  regs.a = regs.inc8(regs.a);
  m.step(0x122a, 4); // inc a
  regs.and(0x01);
  m.step(0x122c, 7); // and 0x01
  mem.write8(0xad32, regs.a);
  m.step(0x122f, 13); // ld (0xad32),a

  regs.a = 0x5a;
  m.step(0x1231, 7); // ld a,0x5a
  mem.write8(0xa9eb, regs.a);
  m.step(0x1234, 13); // ld (0xa9eb),a
  regs.a = mem.read8(0x4b52); // ROM byte, 0x01
  m.step(0x1237, 13); // ld a,(0x4b52)
  mem.write8(0xa9ac, regs.a);
  m.step(0x123a, 13); // ld (0xa9ac),a

  m.ret(); // 0x123a
}
