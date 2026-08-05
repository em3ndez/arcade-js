// SPDX-License-Identifier: GPL-3.0-only

// loc_429c  (ROM 0x429C-0x42B6, Time Pilot)
export function loc_429c(m) {
  const { regs, mem } = m;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(0xa8e6);
  m.step(0x429f, 13); // ld a,(0xa8e6)
  regs.d = regs.a;
  m.step(0x42a0, 4); // ld d,a
  regs.add(regs.a);
  m.step(0x42a1, 4); // add a,a
  regs.c = regs.a;
  m.step(0x42a2, 4); // ld c,a -- the window width

  regs.a = 0x84;
  m.step(0x42a4, 7); // ld a,0x84
  regs.sub(mem.read8(Y(0x00)));
  m.step(0x42a7, 19); // sub (iy+0x00)
  regs.add(regs.d);
  m.step(0x42a8, 4); // add a,d -- re-centre on the window
  regs.cp(regs.c);
  m.step(0x42a9, 4); // cp c

  if (regs.fNC) {
    m.ret(11); // 42a9  ret nc (taken) -- outside the window
    return;
  }
  m.step(0x42aa, 5); // ret nc -- not taken

  regs.a = 0x78;
  m.step(0x42ac, 7); // ld a,0x78
  regs.sub(mem.read8(Y(0x31)));
  m.step(0x42af, 19); // sub (iy+0x31)

  if (regs.fC) {
    m.step(0x42b5, 12); // jr c,0x42b5
    regs.c = 0x01;
    m.step(0x42b7, 7); // ld c,0x01
  } else {
    m.step(0x42b1, 7); // jr c -- not taken
    regs.c = 0x00;
    m.step(0x42b3, 7); // ld c,0x00
    m.step(0x42b7, 12); // jr 0x42b7
  }

  return m.call(0x42b7);
}
