// SPDX-License-Identifier: GPL-3.0-only

// loc_3058  (ROM 0x3058–0x3069)
export function loc_3058(m) {
  const { regs, mem } = m;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.b = mem.read8(IY(0x31));
  m.step(0x305b, 19); // ld b,(iy+0x31)
  regs.c = mem.read8(IY(0x00));
  m.step(0x305e, 19); // ld c,(iy+0x00)
  regs.a = 0x10;
  m.step(0x3060, 7); // ld a,0x10
  regs.add(regs.b);
  m.step(0x3061, 4); // add a,b
  mem.write8(IY(0x33), regs.a);
  m.step(0x3064, 19); // ld (iy+0x33),a
  mem.write8(IY(0x02), regs.c);
  m.step(0x3067, 19); // ld (iy+0x02),c

  m.step(0x309b, 10); // jp 0x309b -- TAIL jump, nothing pushed
  return m.call(0x309b);
}
