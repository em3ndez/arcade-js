// SPDX-License-Identifier: GPL-3.0-only

// loc_2b58  (ROM 0x2B58-0x2B82) — IX sprite-object arm (leaf). Gated on (ix+0x06); fires only when
// (ix+0x04)+2 equals (0x8047); then measures |(iy+0x00)[+0x10 when (ix+0x05)==0] - (0x8044)| and, when
// that lands in [0, 0x10), sets the hit flags (0x8004)=1 and (0x842c)=1.
export function loc_2b58(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x2b5b, 19); // ld a,(ix+0x06)
  regs.or(regs.a);
  m.step(0x2b5c, 4);
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x2b5d, 5);
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
  m.step(0x2b60, 19); // ld a,(ix+0x04)
  regs.add(0x02);
  m.step(0x2b62, 7);
  regs.hl = 0x8047;
  m.step(0x2b65, 10);
  regs.cp(mem.read8(regs.hl));
  m.step(0x2b66, 7); // cp (hl)
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x2b67, 5);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x2b6a, 19); // ld a,(ix+0x05)
  regs.or(regs.a);
  m.step(0x2b6b, 4); // Z latches (ix+0x05)==0 for the jr z below
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x2b6e, 19); // ld a,(iy+0x00) -- a load, leaves the or's Z intact
  regs.hl = 0x8044;
  m.step(0x2b71, 10);
  if (regs.fZ) {
    m.step(0x2b75, 12); // jr z,0x2b75
  } else {
    m.step(0x2b73, 7);
    regs.add(0x10);
    m.step(0x2b75, 7);
  }

  regs.sub(mem.read8(regs.hl));
  m.step(0x2b76, 7); // sub (hl) -- vs (0x8044)
  if (regs.fC) {
    m.ret(11);
    return;
  }
  m.step(0x2b77, 5);
  regs.cp(0x10);
  m.step(0x2b79, 7);
  if (regs.fNC) {
    m.ret(11);
    return;
  }
  m.step(0x2b7a, 5);
  regs.a = 0x01;
  m.step(0x2b7c, 7);
  mem.write8(0x8004, regs.a);
  m.step(0x2b7f, 13);
  mem.write8(0x842c, regs.a);
  m.step(0x2b82, 13);
  m.ret();
}
