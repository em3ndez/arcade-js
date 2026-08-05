// SPDX-License-Identifier: GPL-3.0-only

// loc_3ed6  (ROM 0x3ED6–0x3F92, plus the detached block 0x3F9E–0x3FAE)
export function loc_3ed6(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(0xa980);
  m.step(0x3ed9, 13); // ld a,(0xa980)
  regs.and(0x07);
  m.step(0x3edb, 7); // and 0x07
  regs.add(0x05);
  m.step(0x3edd, 7); // add a,0x05
  regs.cp(mem.read8(X(0x0f)));
  m.step(0x3ee0, 19); // cp (ix+0x0f)
  if (regs.fNZ) { m.ret(11); return; } // ret nz
  m.step(0x3ee1, 5);

  regs.a = mem.read8(0xa817);
  m.step(0x3ee4, 13); // ld a,(0xa817)
  regs.and(regs.a);
  m.step(0x3ee5, 4); // and a
  if (regs.fNZ) { m.ret(11); return; } // ret nz
  m.step(0x3ee6, 5);

  regs.hl = 0xa810;
  m.step(0x3ee9, 10); // ld hl,0xa810
  regs.de = 0xaa12;
  m.step(0x3eec, 10); // ld de,0xaa12
  regs.a = mem.read8(0xa844);
  m.step(0x3eef, 13); // ld a,(0xa844)
  regs.and(regs.a);
  m.step(0x3ef0, 4); // and a
  if (regs.fZ) { m.ret(11); return; } // ret z
  m.step(0x3ef1, 5);
  regs.b = regs.a;
  m.step(0x3ef2, 4); // ld b,a

  let freeSlot = false;
  do {
    regs.a = mem.read8(regs.hl);
    m.step(0x3ef3, 7); // ld a,(hl)
    regs.and(regs.a);
    m.step(0x3ef4, 4); // and a
    if (regs.fZ) {
      m.step(0x3eff, 12); // jr z,0x3eff -- free slot found
      freeSlot = true;
      break;
    }
    m.step(0x3ef6, 7); // jr z -- not taken
    regs.a = regs.l;
    m.step(0x3ef7, 4); // ld a,l
    regs.add(0x10);
    m.step(0x3ef9, 7); // add a,0x10
    regs.l = regs.a;
    m.step(0x3efa, 4); // ld l,a
    regs.e = regs.inc8(regs.e);
    m.step(0x3efb, 4); // inc e
    regs.e = regs.inc8(regs.e);
    m.step(0x3efc, 4); // inc e
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3ef2 : 0x3efe, regs.b !== 0 ? 13 : 8); // djnz 0x3ef2
  } while (regs.b !== 0);
  if (!freeSlot) { m.ret(10); return; } // ret (0x3EFE) -- every slot busy

  mem.write16(0xa991, regs.hl);
  m.step(0x3f02, 16); // ld (0xa991),hl
  mem.write16(0xa993, regs.de);
  m.step(0x3f06, 20); // ld (0xa993),de
  regs.a = mem.read8(0xa827);
  m.step(0x3f09, 13); // ld a,(0xa827)
  regs.b = regs.a;
  m.step(0x3f0a, 4); // ld b,a
  regs.add(regs.a);
  m.step(0x3f0b, 4); // add a,a
  regs.c = regs.a;
  m.step(0x3f0c, 4); // ld c,a
  regs.a = 0x78;
  m.step(0x3f0e, 7); // ld a,0x78
  regs.sub(mem.read8(Y(0x31)));
  m.step(0x3f11, 19); // sub (iy+0x31)
  regs.add(regs.b);
  m.step(0x3f12, 4); // add a,b
  regs.cp(regs.c);
  m.step(0x3f13, 4); // cp c

  if (regs.fNC) {
    m.step(0x3f1d, 12); // jr nc,0x3f1d
  } else {
    m.step(0x3f15, 7); // jr nc -- not taken
    regs.a = 0x84;
    m.step(0x3f17, 7); // ld a,0x84
    regs.sub(mem.read8(Y(0x00)));
    m.step(0x3f1a, 19); // sub (iy+0x00)
    regs.add(regs.b);
    m.step(0x3f1b, 4); // add a,b
    regs.cp(regs.c);
    m.step(0x3f1c, 4); // cp c
    if (regs.fC) { m.ret(11); return; } // ret c
    m.step(0x3f1d, 5);
  }

  regs.a = mem.read8(0xa837);
  m.step(0x3f20, 13); // ld a,(0xa837)
  regs.b = regs.a;
  m.step(0x3f21, 4); // ld b,a
  regs.add(regs.a);
  m.step(0x3f22, 4); // add a,a
  regs.c = regs.a;
  m.step(0x3f23, 4); // ld c,a
  regs.a = mem.read8(0xa802);
  m.step(0x3f26, 13); // ld a,(0xa802)
  regs.sub(mem.read8(X(0x02)));
  m.step(0x3f29, 19); // sub (ix+0x02)
  regs.add(regs.b);
  m.step(0x3f2a, 4); // add a,b
  regs.cp(regs.c);
  m.step(0x3f2b, 4); // cp c
  if (regs.fNC) { m.ret(11); return; } // ret nc
  m.step(0x3f2c, 5);
  regs.a = regs.d;
  m.step(0x3f2d, 4); // ld a,d
  regs.cp(0x02);
  m.step(0x3f2f, 7); // cp 0x02

  if (regs.fZ) {
    m.step(0x3f9e, 10); // jp z,0x3f9e

    regs.a = mem.read8(0xa8e6);
    m.step(0x3fa1, 13); // ld a,(0xa8e6)
    regs.b = regs.a;
    m.step(0x3fa2, 4); // ld b,a
    regs.add(regs.a);
    m.step(0x3fa3, 4); // add a,a
    regs.c = regs.a;
    m.step(0x3fa4, 4); // ld c,a
    regs.a = 0x84;
    m.step(0x3fa6, 7); // ld a,0x84
    regs.sub(mem.read8(Y(0x00)));
    m.step(0x3fa9, 19); // sub (iy+0x00)
    regs.add(regs.b);
    m.step(0x3faa, 4); // add a,b
    regs.cp(regs.c);
    m.step(0x3fab, 4); // cp c
    if (regs.fNC) { m.ret(11); return; } // ret nc
    m.step(0x3fac, 5);
    m.step(0x3f32, 10); // jp 0x3f32 -- back into the body
  } else {
    m.step(0x3f32, 10); // jp z -- not taken
  }

  regs.hl = 0xac7f;
  m.step(0x3f35, 10); // ld hl,0xac7f
  m.push16(0x3f38);
  m.step(0x33b8, 17); // call 0x33b8
  m.call(0x33b8);
  regs.c = regs.a;
  m.step(0x3f39, 4); // ld c,a
  regs.sub(mem.read8(X(0x02)));
  m.step(0x3f3c, 19); // sub (ix+0x02)
  regs.add(0x10);
  m.step(0x3f3e, 7); // add a,0x10
  regs.cp(0x20);
  m.step(0x3f40, 7); // cp 0x20
  if (regs.fNC) { m.ret(11); return; } // ret nc
  m.step(0x3f41, 5);

  m.push16(0x3f44);
  m.step(0x3f93, 17); // call 0x3f93
  m.call(0x3f93);

  m.push16(regs.ix);
  m.step(0x3f46, 15); // push ix
  m.push16(regs.iy);
  m.step(0x3f48, 15); // push iy
  regs.d = mem.read8(Y(0x31));
  m.step(0x3f4b, 19); // ld d,(iy+0x31)
  regs.e = mem.read8(Y(0x00));
  m.step(0x3f4e, 19); // ld e,(iy+0x00)
  regs.ix = mem.read16(0xa991);
  m.step(0x3f52, 20); // ld ix,(0xa991) -- the free record found above
  regs.iy = mem.read16(0xa993);
  m.step(0x3f56, 20); // ld iy,(0xa993)
  mem.write8(Y(0x31), regs.d); // NOTE: the NEW iy
  m.step(0x3f59, 19); // ld (iy+0x31),d
  mem.write8(Y(0x00), regs.e);
  m.step(0x3f5c, 19); // ld (iy+0x00),e
  regs.a = mem.read8(0xad04);
  m.step(0x3f5f, 13); // ld a,(0xad04)
  regs.and(regs.a);
  m.step(0x3f60, 4); // and a
  regs.a = regs.c; // flag-neutral: the branch below still reads `and a`
  m.step(0x3f61, 4); // ld a,c

  if (regs.fNZ) {
    m.step(0x3f68, 12); // jr nz,0x3f68
    m.push16(0x3f6b);
    m.step(0x59d1, 17); // call 0x59d1
    m.call(0x59d1);
  } else {
    m.step(0x3f63, 7); // jr nz -- not taken
    m.push16(0x3f66);
    m.step(0x59cb, 17); // call 0x59cb
    m.call(0x59cb);
    m.step(0x3f6b, 12); // jr 0x3f6b
  }

  mem.write8(X(0x0a), regs.e);
  m.step(0x3f6e, 19); // ld (ix+0x0a),e
  mem.write8(X(0x0b), regs.d);
  m.step(0x3f71, 19); // ld (ix+0x0b),d
  mem.write8(X(0x0c), regs.c);
  m.step(0x3f74, 19); // ld (ix+0x0c),c
  mem.write8(X(0x0d), regs.b);
  m.step(0x3f77, 19); // ld (ix+0x0d),b
  regs.a = mem.read8(Y(0x31)); // DEAD LOAD -- A is overwritten two instructions on
  m.step(0x3f7a, 19); // ld a,(iy+0x31)
  regs.a = mem.read8(Y(0x00)); // DEAD LOAD too; both results are discarded
  m.step(0x3f7d, 19); // ld a,(iy+0x00)
  mem.write8(Y(0x01), 0x4d);
  m.step(0x3f81, 19); // ld (iy+0x01),0x4d
  mem.write8(Y(0x30), 0x62);
  m.step(0x3f85, 19); // ld (iy+0x30),0x62
  regs.a = mem.read8(0xa814);
  m.step(0x3f88, 13); // ld a,(0xa814)
  mem.write8(0xa817, regs.a);
  m.step(0x3f8b, 13); // ld (0xa817),a -- re-arms guard 2
  regs.decMem8(mem, X(0x00));
  m.step(0x3f8e, 23); // dec (ix+0x00)
  regs.iy = m.pop16();
  m.step(0x3f90, 14); // pop iy
  regs.ix = m.pop16();
  m.step(0x3f92, 14); // pop ix

  m.ret(10); // ret (0x3F92)
}
