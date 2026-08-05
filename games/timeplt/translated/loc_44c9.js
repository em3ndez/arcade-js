// SPDX-License-Identifier: GPL-3.0-only

// loc_44c9  (ROM 0x44C9-0x44DB, Time Pilot)
export function loc_44c9(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = regs.c;
  m.step(0x44ca, 4); // ld a,c

  regs.and(0x7f);
  m.step(0x44cc, 7); // and 0x7f -- drop the bit that selected this arm

  regs.cp(0x03);
  m.step(0x44ce, 7); // cp 0x03

  if (regs.fC) {
    m.step(0x44d4, 12); // jr c,0x44d4 taken -- counter already under 3
  } else {
    m.step(0x44d0, 7); // jr c not taken

    mem.write8(X(0x06), 0x00);
    m.step(0x44d4, 19); // ld (ix+0x06),0x00 -- restart the animation counter
  }

  mem.write8(Y(0x30), 0x51);
  m.step(0x44d8, 19); // ld (iy+0x30),0x51

  mem.write8(Y(0x32), 0x51);
  m.step(0x44dc, 19); // ld (iy+0x32),0x51

  return m.call(0x44dc);
}
