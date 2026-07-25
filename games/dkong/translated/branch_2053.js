// SPDX-License-Identifier: GPL-3.0-only

/**
 * branch_2053  (ROM 0x2053–0x20E9) — exx; ACTIVE-MOVEMENT. 239c gravity, 2a2f collision.
 *  then an (ix+3) bounds ladder and an (ix+0e) sub-state dispatch.
 */
export function branch_2053(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.exx();
  m.step(0x2054, 4); // exx
  m.push16(0x2057);
  m.step(0x239c, 17); // call 0x239c
  m.call(0x239c);
  m.push16(0x205a);
  m.step(0x2a2f, 17); // call 0x2a2f
  m.call(0x2a2f); // returns A
  regs.and(regs.a);
  m.step(0x205b, 4); // and a
  if (regs.fNZ) { m.step(0x2083, 10); return m.call(0x2083); } // jp nz -- sub-state
  m.step(0x205e, 10);
  regs.a = mem.read8(R(0x03));
  m.step(0x2061, 19); // ld a,(ix+0x03)
  regs.add(0x08);
  m.step(0x2063, 7); // add a,0x08
  regs.cp(0x10);
  m.step(0x2065, 7); // cp 0x10
  if (regs.fC) { m.step(0x2079, 10); return m.call(0x2079); } // jp c
  m.step(0x2068, 10);
  m.push16(0x206b);
  m.step(0x24b4, 17); // call 0x24b4
  if (!m.call(0x24b4)) return; // skip-capable: spliced to 21ba/loop -> do NOT continue inline
  regs.a = mem.read8(R(0x10));
  m.step(0x206e, 19); // ld a,(ix+0x10)
  regs.and(0x01);
  m.step(0x2070, 7); // and 0x01
  regs.rlca();
  m.step(0x2071, 4); // rlca
  regs.rlca();
  m.step(0x2072, 4); // rlca
  regs.c = regs.a;
  m.step(0x2073, 4); // ld c,a
  m.push16(0x2076);
  m.step(0x23de, 17); // call 0x23de
  m.call(0x23de);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2076, 6); // inc hl
  m.step(0x21ba, 10); // jp 0x21ba
  return m.call(0x21ba);
}
