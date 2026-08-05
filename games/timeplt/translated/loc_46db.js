// SPDX-License-Identifier: GPL-3.0-only

// loc_46db  (ROM 0x46DB-0x46EF, Time Pilot)
export function loc_46db(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.xor(regs.a);
  m.step(0x46dc, 4); // xor a -- A = 0

  mem.write8(X(0x00), regs.a);
  m.step(0x46df, 19); // ld (ix+0x00),a -- release the slot

  mem.write8(Y(0x00), regs.a);
  m.step(0x46e2, 19); // ld (iy+0x00),a

  mem.write8(Y(0x02), regs.a);
  m.step(0x46e5, 19); // ld (iy+0x02),a

  mem.write8(Y(0x31), regs.a);
  m.step(0x46e8, 19); // ld (iy+0x31),a

  mem.write8(Y(0x33), regs.a);
  m.step(0x46eb, 19); // ld (iy+0x33),a

  mem.write8(X(0x0e), 0x5f);
  m.step(0x46ef, 19); // ld (ix+0x0e),0x5f

  m.ret(); // 46ef  ret
}
