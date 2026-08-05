// SPDX-License-Identifier: GPL-3.0-only

// loc_3074  (ROM 0x3074-0x307E, Time Pilot)
export function loc_3074(m) {
  const { regs, mem } = m;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(regs.hl);
  m.step(0x3075, 7); // ld a,(hl)
  regs.add(regs.c);
  m.step(0x3076, 4); // add a,c
  mem.write8(IY(0x33), regs.b);
  m.step(0x3079, 19); // ld (iy+0x33),b
  mem.write8(IY(0x02), regs.a);
  m.step(0x307c, 19); // ld (iy+0x02),a

  m.step(0x309b, 10); // jp 0x309b -- TAIL jump, nothing pushed
  return m.call(0x309b);
}
