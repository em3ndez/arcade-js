// SPDX-License-Identifier: GPL-3.0-only

// loc_3b77  (ROM 0x3B77-0x3B93, Time Pilot)
export function loc_3b77(m) {
  const { regs, mem } = m;
  const IY = (d) => (regs.iy + d) & 0xffff;

  m.push16(0x3b7a);
  m.step(0x3e05, 17); // call 0x3e05
  m.call(0x3e05);

  regs.a = mem.read8(IY(0x31));
  m.step(0x3b7d, 19); // ld a,(iy+0x31)
  regs.add(0x10);
  m.step(0x3b7f, 7); // add a,0x10
  mem.write8(IY(0x33), regs.a);
  m.step(0x3b82, 19); // ld (iy+0x33),a

  regs.a = mem.read8(IY(0x00));
  m.step(0x3b85, 19); // ld a,(iy+0x00)
  mem.write8(IY(0x02), regs.a);
  m.step(0x3b88, 19); // ld (iy+0x02),a

  m.push16(0x3b8b);
  m.step(0x3cc4, 17); // call 0x3cc4 -- answers in carry
  m.call(0x3cc4);

  if (regs.fC) {
    m.step(0x3c0d, 10); // jp c,0x3c0d TAKEN -- TAIL jump, nothing pushed
    return m.call(0x3c0d);
  }
  m.step(0x3b8e, 10); // jp c NOT taken

  m.push16(0x3b91);
  m.step(0x3ce9, 17); // call 0x3ce9
  m.call(0x3ce9);

  m.step(0x3d25, 10); // jp 0x3d25 -- TAIL jump, nothing pushed
  return m.call(0x3d25);
}
