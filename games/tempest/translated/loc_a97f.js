// SPDX-License-Identifier: GPL-3.0-only
// loc_a97f  (ROM 0xa97f-0xa9d6) -- builds a 7-entry vector-list at $2f60,x from $cdde/$cde0 base
// indices; sets up $3b/$3c pointer then falls through to loc_a9d7. Early rts (a9c9->a9fb) when
// $00==4 and Y!=$3d. Indexed reads off $cdde/$cde0/$0048/$a97d may add +1 T on a page cross.
export function loc_a97f(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x00); regs.setNZ(regs.x); m.step(0xa981, 3);
  regs.cpx(0x04); m.step(0xa983, 2);
  mem.write8(0x2b, regs.y); m.step(0xa985, 3);
  regs.cpy(mem.read8(0x3d)); m.step(0xa987, 3);
  // a987 bne 0xa98f
  if (regs.fNZ) {
    m.step(0xa98f, 3);
  } else {
    m.step(0xa989, 2);
    regs.bit(mem.read8(0x05)); m.step(0xa98b, 3);
    // a98b bpl 0xa98f
    if (regs.fPl) {
      m.step(0xa98f, 3);
    } else {
      m.step(0xa98d, 2);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa98f, 2);
    }
  }
  regs.ora(0x70); m.step(0xa991, 2);
  regs.x = mem.read8((0xcdde + regs.y) & 0xffff); regs.setNZ(regs.x); m.step(0xa994, 4);
  mem.write8((0x2f60 + regs.x) & 0xffff, regs.a); m.step(0xa997, 5);
  regs.x = mem.read8((0xcde0 + regs.y) & 0xffff); regs.setNZ(regs.x); m.step(0xa99a, 4);
  regs.a = mem.read8((0x0048 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa99d, 4);
  mem.write8(0x38, regs.a); m.step(0xa99f, 3);
  // a99f beq 0xa9a7
  if (regs.fZ) {
    m.step(0xa9a7, 3);
  } else {
    m.step(0xa9a1, 2);
    regs.cpy(mem.read8(0x3d)); m.step(0xa9a3, 3);
    // a9a3 bne 0xa9a7
    if (regs.fNZ) {
      m.step(0xa9a7, 3);
    } else {
      m.step(0xa9a5, 2);
      mem.write8(0x38, regs.dec8(mem.read8(0x38))); m.step(0xa9a7, 5);
    }
  }
  regs.y = 0x01; regs.setNZ(regs.y); m.step(0xa9a9, 2);
  do {
    regs.a = mem.read8(0x3284); regs.setNZ(regs.a); m.step(0xa9ac, 4);
    regs.cpy(mem.read8(0x38)); m.step(0xa9ae, 3);
    // a9ae bcc 0xa9b5
    if (regs.fNC) {
      m.step(0xa9b5, 3);
    } else {
      m.step(0xa9b0, 2);
      // a9b0 beq 0xa9b5
      if (regs.fZ) {
        m.step(0xa9b5, 3);
      } else {
        m.step(0xa9b2, 2);
        regs.a = mem.read8(0x3286); regs.setNZ(regs.a); m.step(0xa9b5, 4);
      }
    }
    mem.write8((0x2f60 + regs.x) & 0xffff, regs.a); m.step(0xa9b8, 5);
    regs.x = regs.inc8(regs.x); m.step(0xa9b9, 2);
    regs.x = regs.inc8(regs.x); m.step(0xa9ba, 2);
    regs.y = regs.inc8(regs.y); m.step(0xa9bb, 2);
    regs.cpy(0x07); m.step(0xa9bd, 2);
    // a9bd bcc 0xa9a9
    if (regs.fNC) { m.step(0xa9a9, 3); } else { m.step(0xa9bf, 2); break; }
  } while (true);
  regs.y = mem.read8(0x2b); regs.setNZ(regs.y); m.step(0xa9c1, 3);
  regs.a = mem.read8(0x00); regs.setNZ(regs.a); m.step(0xa9c3, 3);
  regs.cmp(0x04); m.step(0xa9c5, 2);
  // a9c5 bne 0xa9cb
  if (regs.fNZ) {
    m.step(0xa9cb, 3);
  } else {
    m.step(0xa9c7, 2);
    regs.cpy(mem.read8(0x3d)); m.step(0xa9c9, 3);
    // a9c9 bne 0xa9fb -- cross-routine early exit to the bare rts at a9fb (in loc_a9d7)
    if (regs.fNZ) { m.step(0xa9fb, 3); return m.ret(6); }
    m.step(0xa9cb, 2);
  }
  regs.x = mem.read8((0xcde2 + regs.y) & 0xffff); regs.setNZ(regs.x); m.step(0xa9ce, 4);
  regs.a = mem.read8((0xa97d + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa9d1, 4);
  mem.write8(0x3b, regs.a); m.step(0xa9d3, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa9d5, 2);
  mem.write8(0x3c, regs.a); m.step(0xa9d7, 3);
  return m.call(0xa9d7);
}
