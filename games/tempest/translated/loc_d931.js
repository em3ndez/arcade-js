// SPDX-License-Identifier: GPL-3.0-only
// loc_d931  (ROM 0xd931-0xd93e) -- A->Y, load $01, if >=0x20 wrap via sbc #0x18, mask #0x1f, tail-jmp 0xd8cd.
export function loc_d931(m) {
  const { regs, mem } = m;
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xd932, 2);
  regs.a = mem.read8(0x0001); regs.setNZ(regs.a); m.step(0xd934, 3);
  regs.cmp(0x20); m.step(0xd936, 2);
  if (regs.fNC) {
    m.step(0xd93a, 3);
  } else {
    m.step(0xd938, 2);
    regs.sbc(0x18); m.step(0xd93a, 2);
  }
  regs.and(0x1f); m.step(0xd93c, 2);
  m.step(0xd8cd, 3); return m.call(0xd8cd);
}
