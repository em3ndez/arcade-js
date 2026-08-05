// SPDX-License-Identifier: GPL-3.0-only

// loc_4d67  (ROM 0x4D67–0x4D71)
export function loc_4d67(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x4d68, 7); // ld a,(hl)
  regs.add(0x01);
  m.step(0x4d6a, 7); // add a,0x01
  regs.daa();
  m.step(0x4d6b, 4); // daa
  mem.write8(regs.hl, regs.a); // stored before the wrap test
  m.step(0x4d6c, 7); // ld (hl),a
  regs.cp(0x60); // BCD sixty
  m.step(0x4d6e, 7); // cp 0x60
  if (regs.fC) {
    m.step(m.pop16(), 11); // ret c
    return;
  }
  m.step(0x4d6f, 5);

  mem.write8(regs.hl, 0x00);
  m.step(0x4d71, 10); // ld (hl),0x00

  m.ret(); // 4d71
}
