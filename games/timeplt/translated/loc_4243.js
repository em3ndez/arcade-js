// SPDX-License-Identifier: GPL-3.0-only

// loc_4243  (ROM 0x4243-0x429B, Time Pilot)
export function loc_4243(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa980);
  m.step(0x4246, 13); // ld a,(0xa980)
  regs.and(0x07);
  m.step(0x4248, 7); // and 0x07
  regs.add(0x05);
  m.step(0x424a, 7); // add a,0x05
  regs.cp(mem.read8((regs.ix + 0x0f) & 0xffff));
  m.step(0x424d, 19); // cp (ix+0x0f) -- this object's slot in the 8-frame round
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- not this object's frame
    return;
  }
  m.step(0x424e, 5); // ret nz NOT taken

  regs.hl = 0xa8f4;
  m.step(0x4251, 10); // ld hl,0xa8f4 -- the cooldown
  regs.a = mem.read8(regs.hl);
  m.step(0x4252, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x4253, 4); // and a
  if (regs.fZ) {
    m.step(0x4257, 12); // jr z,0x4257 taken -- cooldown expired
  } else {
    m.step(0x4255, 7); // jr z NOT taken
    regs.decMem8(mem, regs.hl);
    m.step(0x4256, 11); // dec (hl)
    m.ret(10); // ret -- still cooling down
    return;
  }

  regs.hl = 0xa8c0;
  m.step(0x425a, 10); // ld hl,0xa8c0 -- slot table base
  regs.de = 0xaa28;
  m.step(0x425d, 10); // ld de,0xaa28 -- parallel table, stride 2
  regs.a = mem.read8(0xa8c6);
  m.step(0x4260, 13); // ld a,(0xa8c6) -- slot count
  regs.and(regs.a);
  m.step(0x4261, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z taken -- no slots at all
    return;
  }
  m.step(0x4262, 5); // ret z NOT taken

  regs.b = regs.a;
  m.step(0x4263, 4); // ld b,a -- loop counter

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x4264, 7); // ld a,(hl)
    regs.and(regs.a);
    m.step(0x4265, 4); // and a -- Z iff the slot is free
    if (regs.fZ) {
      m.step(0x4271, 10); // jp z,0x4271 taken -- free slot found
      break;
    }
    m.step(0x4268, 10); // jp z NOT taken

    regs.a = regs.l;
    m.step(0x4269, 4); // ld a,l
    regs.add(0x10);
    m.step(0x426b, 7); // add a,0x10 -- next slot; L only, H is never carried into
    regs.l = regs.a;
    m.step(0x426c, 4); // ld l,a
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x426d, 6); // inc de
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x426e, 6); // inc de
    if (regs.djnz() !== 0) {
      m.step(0x4263, 13); // djnz 0x4263 taken
      continue;
    }
    m.step(0x4270, 8); // djnz NOT taken -- every slot busy
    m.ret(10); // ret
    return;
  }

  mem.write16(0xa991, regs.hl);
  m.step(0x4274, 16); // ld (0xa991),hl -- the free slot
  mem.write16(0xa993, regs.de);
  m.step(0x4278, 20); // ld (0xa993),de -- its parallel entry
  regs.a = mem.read8(0xa8d6);
  m.step(0x427b, 13); // ld a,(0xa8d6)
  regs.d = regs.a;
  m.step(0x427c, 4); // ld d,a -- D = the margin
  regs.add(regs.a);
  m.step(0x427d, 4); // add a,a
  regs.c = regs.a;
  m.step(0x427e, 4); // ld c,a -- C = 2*margin
  regs.a = 0x78;
  m.step(0x4280, 7); // ld a,0x78
  regs.sub(mem.read8((regs.iy + 0x31) & 0xffff));
  m.step(0x4283, 19); // sub (iy+0x31)
  regs.add(regs.d);
  m.step(0x4284, 4); // add a,d
  regs.cp(regs.c);
  m.step(0x4285, 4); // cp c

  if (regs.fNC) {
    m.step(0x428f, 12); // jr nc,0x428f taken -- far enough on this axis
  } else {
    m.step(0x4287, 7); // jr nc NOT taken -- try the other axis
    regs.a = 0x84;
    m.step(0x4289, 7); // ld a,0x84
    regs.sub(mem.read8((regs.iy + 0x00) & 0xffff));
    m.step(0x428c, 19); // sub (iy+0x00)
    regs.add(regs.d);
    m.step(0x428d, 4); // add a,d
    regs.cp(regs.c);
    m.step(0x428e, 4); // cp c
    if (regs.fC) {
      m.ret(11); // ret c taken -- too close on both axes
      return;
    }
    m.step(0x428f, 5); // ret c NOT taken
  }

  regs.c = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x4292, 19); // ld c,(ix+0x02)
  regs.a = mem.read8(0xad04);
  m.step(0x4295, 13); // ld a,(0xad04)
  regs.and(regs.a);
  m.step(0x4296, 4); // and a
  if (regs.fZ) {
    m.step(0x429c, 10); // jp z,0x429c -- tail-jump
    return m.call(0x429c);
  }
  m.step(0x4299, 10); // jp z NOT taken

  m.step(0x42b7, 10); // jp 0x42b7 -- tail-jump
  return m.call(0x42b7);
}
