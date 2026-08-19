// SPDX-License-Identifier: GPL-3.0-only

// loc_3a6c  (ROM 0x3a6c-0x3b29) -- launch a projectile/actor into a free slot in the 0x8be8 table.
// Bumps the spawn counter (0x8d42), then scans 3 records (stride 0x18) at 0x8be8 for a free slot
// (bit 0 of (iy+0)|(iy+1) clear). No free slot -> ret. Otherwise it seeds the found IY record from
// the launcher IX record: a heading index from (ix+6) picks a coord pair via loc_0c45 (table 0x3b57
// or 0x3b47 by (0x8907) bit0), an animation is queued via loc_381e (0x396a/0x3979/0x39a0 by
// (ix+7) bit1 and (ix+16)&0x30), a hit-flash sprite (0x3bdd/0x433b/0x4341) and a display attribute
// (rst 0x20 table 0x3b37/0x3b3f, index (0x8d6c)&7) are stored, and (ix+8) is nudged by -0x10.
// The data at 0x3b2a-0x3b86 following the ret is TABLE data (rst-0x20 attribute tables 0x3b37/0x3b3f,
// loc_0c45 word tables 0x3b47/0x3b57 and their coord records 0x3b67-0x3b86); read from ROM directly.
export function loc_3a6c(m) {
  const { regs, mem } = m;

  regs.hl = 0x8d42; m.step(0x3a6f, 10);
  regs.incMem8(mem, regs.hl); m.step(0x3a70, 11); // 3a6f  inc (hl) -- spawn counter
  regs.iy = 0x8be8; m.step(0x3a74, 14);
  regs.b = 0x03; m.step(0x3a76, 7);
  regs.de = 0x0018; m.step(0x3a79, 10);

  // scan up to 3 records for a free slot; a free slot (bit0 of the OR clear) falls out to 0x3a87
  for (;;) {
    regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x3a7c, 19);
    regs.or(mem.read8((regs.iy + 0x01) & 0xffff)); m.step(0x3a7f, 19);
    regs.rrca(); m.step(0x3a80, 4); // 3a7f  rrca -- bit0 -> carry
    if (regs.fNC) { m.step(0x3a87, 12); break; } // 3a80  jr nc,0x3a87 -- slot free
    m.step(0x3a82, 7);
    regs.addIy(regs.de); m.step(0x3a84, 15); // 3a82  add iy,de -- next record
    if (regs.djnz() !== 0) { m.step(0x3a79, 13); continue; }
    m.step(0x3a86, 8);
    m.ret(); return; // 3a86  ret -- no free slot
  }

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x3a8a, 19);
  regs.sub(0x06); m.step(0x3a8c, 7);
  regs.a = regs.srl(regs.a); m.step(0x3a8e, 8);
  regs.and(0x07); m.step(0x3a90, 7);
  regs.c = regs.a; m.step(0x3a91, 4); // 3a90  ld c,a -- heading index
  regs.hl = 0x3b57; m.step(0x3a94, 10);
  regs.a = mem.read8(0x8907); m.step(0x3a97, 13);
  regs.bit(0, regs.a); m.step(0x3a99, 8);
  if (regs.fNZ) {
    m.step(0x3a9b, 7);
    regs.hl = 0x3b47; m.step(0x3a9e, 10);
  } else {
    m.step(0x3a9e, 12);
  }
  regs.a = regs.c; m.step(0x3a9f, 4);
  m.push16(0x3aa2); m.step(0x0c45, 17); m.call(0x0c45);
  regs.a = mem.read8(regs.de); m.step(0x3aa3, 7);
  mem.write8((regs.iy + 0x12) & 0xffff, regs.a); m.step(0x3aa6, 19);
  regs.de = (regs.de + 1) & 0xffff; m.step(0x3aa7, 6);
  regs.a = mem.read8(regs.de); m.step(0x3aa8, 7);
  mem.write8((regs.iy + 0x13) & 0xffff, regs.a); m.step(0x3aab, 19);
  mem.write8((regs.iy + 0x08) & 0xffff, regs.set(0, mem.read8((regs.iy + 0x08) & 0xffff))); m.step(0x3aaf, 23);
  regs.de = 0x396a; m.step(0x3ab2, 10);
  regs.bit(1, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x3ab6, 20);
  if (regs.fNZ) {
    m.step(0x3ab8, 7);
    regs.de = 0x3979; m.step(0x3abb, 10);
  } else {
    m.step(0x3abb, 12);
  }
  regs.a = mem.read8((regs.ix + 0x16) & 0xffff); m.step(0x3abe, 19);
  regs.and(0x30); m.step(0x3ac0, 7);
  regs.cp(0x30); m.step(0x3ac2, 7);
  if (regs.fZ) {
    m.step(0x3ac4, 7);
    regs.de = 0x39a0; m.step(0x3ac7, 10);
  } else {
    m.step(0x3ac7, 12);
  }
  m.push16(0x3aca); m.step(0x381e, 17); m.call(0x381e); // 3ac7  call 0x381e -- queue animation
  regs.a = mem.read8((regs.ix + 0x08) & 0xffff); m.step(0x3acd, 19);
  regs.sub(0x10); m.step(0x3acf, 7);
  mem.write8((regs.ix + 0x08) & 0xffff, regs.a); m.step(0x3ad2, 19);
  mem.write8((regs.iy + 0x00) & 0xffff, 0x01); m.step(0x3ad6, 19); // 3ad2  ld (iy+0),0x01 -- mark active
  mem.write8((regs.iy + 0x02) & 0xffff, 0x0b); m.step(0x3ada, 19);
  mem.write8((regs.iy + 0x07) & 0xffff, 0x01); m.step(0x3ade, 19);
  regs.a = mem.read8(0x8f50); m.step(0x3ae1, 13);
  regs.and(regs.a); m.step(0x3ae2, 4);
  regs.de = 0x3bdd; m.step(0x3ae5, 10);
  if (regs.fZ) {
    m.step(0x3af4, 12);
  } else {
    m.step(0x3ae7, 7);
    regs.de = 0x433b; m.step(0x3aea, 10);
    regs.a = mem.read8(0x8907); m.step(0x3aed, 13);
    regs.bit(2, regs.a); m.step(0x3aef, 8);
    if (regs.fNZ) {
      m.step(0x3af1, 7);
      regs.de = 0x4341; m.step(0x3af4, 10);
    } else {
      m.step(0x3af4, 12);
    }
  }
  mem.write8((regs.iy + 0x0c) & 0xffff, regs.e); m.step(0x3af7, 19);
  mem.write8((regs.iy + 0x0d) & 0xffff, regs.d); m.step(0x3afa, 19);
  mem.write8((regs.iy + 0x0e) & 0xffff, 0x00); m.step(0x3afe, 19);
  mem.write8((regs.iy + 0x16) & 0xffff, 0x00); m.step(0x3b02, 19);
  mem.write8((regs.iy + 0x11) & 0xffff, 0x13); m.step(0x3b06, 19);
  m.push16(regs.ix); m.step(0x3b08, 15);
  regs.hl = m.pop16(); m.step(0x3b09, 10); // 3b08  pop hl -- HL = IX
  mem.write8((regs.iy + 0x14) & 0xffff, regs.l); m.step(0x3b0c, 19);
  mem.write8((regs.iy + 0x15) & 0xffff, regs.h); m.step(0x3b0f, 19);
  regs.hl = 0x8d6c; m.step(0x3b12, 10);
  regs.incMem8(mem, regs.hl); m.step(0x3b13, 11);
  regs.a = mem.read8(regs.hl); m.step(0x3b14, 7);
  regs.and(0x07); m.step(0x3b16, 7);
  regs.d = regs.a; m.step(0x3b17, 4); // 3b16  ld d,a -- attribute index
  regs.hl = 0x3b37; m.step(0x3b1a, 10);
  regs.a = mem.read8(0x8907); m.step(0x3b1d, 13);
  regs.bit(0, regs.a); m.step(0x3b1f, 8);
  if (regs.fNZ) {
    m.step(0x3b21, 7);
    regs.hl = 0x3b3f; m.step(0x3b24, 10);
  } else {
    m.step(0x3b24, 12);
  }
  regs.a = regs.d; m.step(0x3b25, 4);
  m.push16(0x3b26); m.step(0x0020, 11); m.call(0x0020);
  mem.write8((regs.ix + 0x15) & 0xffff, regs.a); m.step(0x3b29, 19);
  m.ret();
}
