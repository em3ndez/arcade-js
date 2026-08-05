// SPDX-License-Identifier: GPL-3.0-only

// loc_2c22  (ROM 0x2C22–0x2C30)
export function loc_2c22(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  regs.hl = 0x2c31;
  m.step(0x2c25, 10); // ld hl,0x2c31
  m.push16(regs.hl);
  m.step(0x2c26, 11); // push hl -- continuation, popped by the tail target's ret
  regs.a = mem.read8(X(0x00));
  m.step(0x2c29, 19); // ld a,(ix+0x00)
  regs.cp(0x20);
  m.step(0x2c2b, 7); // cp 0x20

  if (regs.fNC) {
    m.step(0x2bb4, 10); // jp nc,0x2bb4
    m.call(0x2bb4);
  } else {
    m.step(0x2c2e, 10); // jp nc -- not taken
    m.step(0x2b60, 10); // jp 0x2b60
    m.call(0x2b60);
  }

  return m.call(0x2c31);
}
