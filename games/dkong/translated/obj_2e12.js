// SPDX-License-Identifier: GPL-3.0-only

/**
 * obj_2e12  (ROM 0x2E12–0x2E48) — process one object; every path converges on loc_2e78 (the IX/IY advance).
 */
export function obj_2e12(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  const RY = (d) => (regs.iy + d) & 0xffff;
  regs.a = mem.read8(R(0x00));
  m.step(0x2e15, 19); // ld a,(ix+0x00)
  regs.rrca();
  m.step(0x2e16, 4); // rrca -- bit0 = active?
  if (regs.fNC) { m.step(0x2ea7, 10); return m.call(0x2ea7); } // jp nc,0x2ea7 (inactive)
  m.step(0x2e19, 10);
  regs.a = mem.read8(0x601a);
  m.step(0x2e1c, 13); // ld a,(0x601a)
  regs.and(0x0f);
  m.step(0x2e1e, 7); // and 0x0f
  if (regs.fNZ) {
    m.step(0x2e29, 10); // jp nz,0x2e29 (not the 16-frame tick)
  } else {
    m.step(0x2e21, 10);
    regs.a = mem.read8(RY(0x01));
    m.step(0x2e24, 19); // ld a,(iy+0x01)
    regs.xor(0x07);
    m.step(0x2e26, 7); // xor 0x07
    mem.write8(RY(0x01), regs.a);
    m.step(0x2e29, 19); // ld (iy+0x01),a
  }
  // -- loc_2e29 --
  regs.a = mem.read8(R(0x0d));
  m.step(0x2e2c, 19); // ld a,(ix+0x0d)
  regs.cp(0x04);
  m.step(0x2e2e, 7); // cp 0x04
  if (regs.fZ) { m.step(0x2e84, 10); return m.call(0x2e84); } // jp z,0x2e84 (state 4)
  m.step(0x2e31, 10);
  regs.incMem8(mem, R(0x03));
  m.step(0x2e34, 23); // inc (ix+0x03)
  regs.incMem8(mem, R(0x03));
  m.step(0x2e37, 23); // inc (ix+0x03) -- position += 2
  regs.l = mem.read8(R(0x0e));
  m.step(0x2e3a, 19); // ld l,(ix+0x0e)
  regs.h = mem.read8(R(0x0f));
  m.step(0x2e3d, 19); // ld h,(ix+0x0f)
  regs.a = mem.read8(regs.hl);
  m.step(0x2e3e, 7); // ld a,(hl)
  regs.c = regs.a;
  m.step(0x2e3f, 4); // ld c,a
  regs.cp(0x7f);
  m.step(0x2e41, 7); // cp 0x7f
  if (regs.fZ) { m.step(0x2e9c, 10); return m.call(0x2e9c); } // jp z,0x2e9c (terminator)
  m.step(0x2e44, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2e45, 6); // inc hl
  regs.add(mem.read8(R(0x05)));
  m.step(0x2e48, 19); // add a,(ix+0x05)
  mem.write8(R(0x05), regs.a);
  m.step(0x2e4b, 19); // ld (ix+0x05),a -- falls into loc_2e4b
  return m.call(0x2e4b);
}
