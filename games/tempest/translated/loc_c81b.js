// SPDX-License-Identifier: GPL-3.0-only
// loc_c81b  (ROM 0xc81b-0xc890) -- from $06 (cmp #2) + $4e&$60 decides a Y count (0..2), decrements $06 by
//   it, and on nonzero: sets $05|=0xc0, zeroes $16/$18/$00, bumps a 16-bit counter at $040c,x (x=$3e-1 clamped
//   to 3) and clamps $0100+$3e to 0x63; on the $4e&$60==0 path, if $50!=0 and $05 bit7 clear seeds $01/$04/
//   $00/$02 and clears $50/$0123. $4e is always zeroed. All branches in-range -> JS control flow. rts at c890.
export function loc_c81b(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x06); regs.setNZ(regs.a); m.step(0xc81d, 3);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xc81f, 2);
  regs.cmp(0x02); m.step(0xc821, 2);
  regs.a = mem.read8(0x4e); regs.setNZ(regs.a); m.step(0xc823, 3);
  regs.and(0x60); m.step(0xc825, 2);
  mem.write8(0x4e, regs.y); m.step(0xc827, 3);

  if (regs.fZ) {
    m.step(0xc871, 3);
    regs.a = mem.read8(0x50); regs.setNZ(regs.a); m.step(0xc873, 3);
    if (regs.fZ) { m.step(0xc890, 3); return m.ret(6); }
    m.step(0xc875, 2);
    regs.bit(mem.read8(0x05)); m.step(0xc877, 3);
    if (regs.fN) { m.step(0xc890, 3); return m.ret(6); }
    m.step(0xc879, 2);
    regs.a = 0x10; regs.setNZ(regs.a); m.step(0xc87b, 2);
    mem.write8(0x01, regs.a); m.step(0xc87d, 3);
    regs.a = 0x20; regs.setNZ(regs.a); m.step(0xc87f, 2);
    mem.write8(0x04, regs.a); m.step(0xc881, 3);
    regs.a = 0x0a; regs.setNZ(regs.a); m.step(0xc883, 2);
    mem.write8(0x00, regs.a); m.step(0xc885, 3);
    regs.a = 0x14; regs.setNZ(regs.a); m.step(0xc887, 2);
    mem.write8(0x02, regs.a); m.step(0xc889, 3);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc88b, 2);
    mem.write8(0x50, regs.a); m.step(0xc88d, 3);
    mem.write8(0x0123, regs.a); m.step(0xc890, 4);
    return m.ret(6);
  }
  m.step(0xc829, 2);

  if (regs.fC) {
    m.step(0xc830, 3);
    regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xc831, 2);
    { const d = (mem.read8(0x06) - 1) & 0xff; mem.write8(0x06, d); regs.setNZ(d); } m.step(0xc833, 5);
    regs.and(0x40); m.step(0xc835, 2);
  } else {
    m.step(0xc82b, 2);
    regs.and(0x20); m.step(0xc82d, 2);
    regs.clv(); m.step(0xc82e, 2);
    m.step(0xc835, 3);
  }

  if (regs.fZ) {
    m.step(0xc83a, 3);
  } else {
    m.step(0xc837, 2);
    { const d = (mem.read8(0x06) - 1) & 0xff; mem.write8(0x06, d); regs.setNZ(d); } m.step(0xc839, 5);
    regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xc83a, 2);
  }

  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xc83b, 2);
  mem.write8(0x3e, regs.a); m.step(0xc83d, 3);
  if (regs.fZ) {
    m.step(0xc86e, 3);
  } else {
    m.step(0xc83f, 2);
    regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xc841, 3);
    regs.ora(0xc0); m.step(0xc843, 2);
    mem.write8(0x05, regs.a); m.step(0xc845, 3);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc847, 2);
    mem.write8(0x16, regs.a); m.step(0xc849, 3);
    mem.write8(0x18, regs.a); m.step(0xc84b, 3);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc84d, 2);
    mem.write8(0x00, regs.a); m.step(0xc84f, 3);
    { const d = (mem.read8(0x3e) - 1) & 0xff; mem.write8(0x3e, d); regs.setNZ(d); } m.step(0xc851, 5);
    regs.x = mem.read8(0x3e); regs.setNZ(regs.x); m.step(0xc853, 3);
    if (regs.fZ) {
      m.step(0xc857, 3);
    } else {
      m.step(0xc855, 2);
      regs.x = 0x03; regs.setNZ(regs.x); m.step(0xc857, 2);
    }
    { const addr = (0x040c + regs.x) & 0xffff; const d = (mem.read8(addr) + 1) & 0xff; mem.write8(addr, d); regs.setNZ(d); } m.step(0xc85a, 7);
    if (regs.fNZ) {
      m.step(0xc85f, 3);
    } else {
      m.step(0xc85c, 2);
      { const addr = (0x040d + regs.x) & 0xffff; const d = (mem.read8(addr) + 1) & 0xff; mem.write8(addr, d); regs.setNZ(d); } m.step(0xc85f, 7);
    }
    regs.a = mem.read8(0x0100); regs.setNZ(regs.a); m.step(0xc862, 4);
    regs.sec(); m.step(0xc863, 2);
    regs.adc(mem.read8(0x3e)); m.step(0xc865, 3);
    regs.cmp(0x63); m.step(0xc867, 2);
    if (regs.fNC) {
      m.step(0xc86b, 3);
    } else {
      m.step(0xc869, 2);
      regs.a = 0x63; regs.setNZ(regs.a); m.step(0xc86b, 2);
    }
    mem.write8(0x0100, regs.a); m.step(0xc86e, 4);
  }

  regs.clv(); m.step(0xc86f, 2);
  m.step(0xc890, 3);
  return m.ret(6);
}
