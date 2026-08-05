// SPDX-License-Identifier: GPL-3.0-only

// loc_4447  (ROM 0x4447–0x44C8)
export function loc_4447(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  m.push16(0x444a);
  m.step(0x3cc4, 17); // call 0x3cc4
  m.call(0x3cc4);

  if (regs.fC) {
    m.step(0x46db, 10); // jp c,0x46db
    return m.call(0x46db);
  }
  m.step(0x444d, 10);

  regs.a = mem.read8(0xad04);
  m.step(0x4450, 13); // ld a,(0xad04)
  regs.d = regs.a;
  m.step(0x4451, 4); // ld d,a
  regs.cp(0x04);
  m.step(0x4453, 7); // cp 0x04

  if (regs.fZ) {
    m.step(0x44a2, 10); // jp z,0x44a2

    regs.a = mem.read8(X(0x04));
    m.step(0x44a5, 19); // ld a,(ix+0x04)
    regs.e = regs.a;
    m.step(0x44a6, 4); // ld e,a
    regs.cp(0x07);
    m.step(0x44a8, 7); // cp 0x07
    if (regs.fZ) {
      m.step(0x44bf, 10); // jp z,0x44bf
    } else {
      m.step(0x44ab, 10);
      regs.incMem8(mem, X(0x06));
      m.step(0x44ae, 23); // inc (ix+0x06)
      regs.c = mem.read8(X(0x06));
      m.step(0x44b1, 19); // ld c,(ix+0x06)
      regs.bit(7, regs.c);
      m.step(0x44b3, 8); // bit 7,c
      if (regs.fNZ) {
        m.step(0x44c9, 12); // jr nz,0x44c9 -- tail transfer
        return m.call(0x44c9);
      }
      m.step(0x44b5, 7);
      regs.a = regs.e;
      m.step(0x44b6, 4); // ld a,e
      regs.add(0x02);
      m.step(0x44b8, 7); // add a,0x02
      regs.cp(regs.c);
      m.step(0x44b9, 4); // cp c
      if (regs.fNC) {
        m.step(0x44bf, 12); // jr nc,0x44bf
      } else {
        m.step(0x44bb, 7);
        mem.write8(X(0x06), 0x80);
        m.step(0x44bf, 19); // ld (ix+0x06),0x80
      }
    }

    mem.write8(Y(0x30), 0x70);
    m.step(0x44c3, 19); // ld (iy+0x30),0x70
    mem.write8(Y(0x32), 0x70);
    m.step(0x44c7, 19); // ld (iy+0x32),0x70
    m.step(0x44dc, 12); // jr 0x44dc -- tail transfer
    return m.call(0x44dc);
  }
  m.step(0x4456, 10);

  regs.a = regs.d;
  m.step(0x4457, 4); // ld a,d
  regs.add(regs.a);
  m.step(0x4458, 4); // add a,a
  regs.add(regs.a);
  m.step(0x4459, 4); // add a,a
  regs.add(regs.a);
  m.step(0x445a, 4); // add a,a
  regs.add(regs.a);
  m.step(0x445b, 4); // add a,a -- 16 per (0xad04)
  regs.b = regs.a;
  m.step(0x445c, 4); // ld b,a
  regs.a = mem.read8(0xa980);
  m.step(0x445f, 13); // ld a,(0xa980)
  regs.and(0x02);
  m.step(0x4461, 7); // and 0x02
  regs.add(regs.b);
  m.step(0x4462, 4); // add a,b
  regs.b = regs.a;
  m.step(0x4463, 4); // ld b,a
  regs.a = 0x07;
  m.step(0x4465, 7); // ld a,0x07
  regs.sub(mem.read8(X(0x04)));
  m.step(0x4468, 19); // sub (ix+0x04)
  regs.rrca();
  m.step(0x4469, 4); // rrca
  regs.and(0x03);
  m.step(0x446b, 7); // and 0x03
  regs.e = regs.a;
  m.step(0x446c, 4); // ld e,a
  regs.add(regs.a);
  m.step(0x446d, 4); // add a,a
  regs.add(regs.a);
  m.step(0x446e, 4); // add a,a -- 4 bytes per quadrant
  regs.add(regs.b);
  m.step(0x446f, 4); // add a,b
  regs.hl = 0x44f1;
  m.step(0x4472, 10); // ld hl,0x44f1

  m.push16(0x4473);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.b = mem.read8(regs.hl);
  m.step(0x4474, 7); // ld b,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4475, 6); // inc hl
  regs.c = mem.read8(regs.hl);
  m.step(0x4476, 7); // ld c,(hl)
  regs.hl = 0x4531;
  m.step(0x4479, 10); // ld hl,0x4531
  regs.a = regs.d;
  m.step(0x447a, 4); // ld a,d

  m.push16(0x447b);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.d = mem.read8(regs.hl); // the attribute byte
  m.step(0x447c, 7); // ld d,(hl)
  regs.a = mem.read8(X(0x02));
  m.step(0x447f, 19); // ld a,(ix+0x02)
  regs.add(0x40);
  m.step(0x4481, 7); // add a,0x40
  regs.cp(0x80);
  m.step(0x4483, 7); // cp 0x80
  if (regs.fC) {
    m.step(0x4495, 12); // jr c,0x4495

    mem.write8(Y(0x01), regs.c);
    m.step(0x4498, 19); // ld (iy+0x01),c
    mem.write8(Y(0x03), regs.b);
    m.step(0x449b, 19); // ld (iy+0x03),b
    mem.write8(Y(0x30), regs.d);
    m.step(0x449e, 19); // ld (iy+0x30),d
    mem.write8(Y(0x32), regs.d);
    m.step(0x44a1, 19); // ld (iy+0x32),d
    m.ret(); // 44a1
    return;
  }
  m.step(0x4485, 7);

  mem.write8(Y(0x01), regs.b);
  m.step(0x4488, 19); // ld (iy+0x01),b
  mem.write8(Y(0x03), regs.c);
  m.step(0x448b, 19); // ld (iy+0x03),c
  regs.a = regs.d;
  m.step(0x448c, 4); // ld a,d
  regs.add(0x80);
  m.step(0x448e, 7); // add a,0x80
  mem.write8(Y(0x30), regs.a);
  m.step(0x4491, 19); // ld (iy+0x30),a
  mem.write8(Y(0x32), regs.a);
  m.step(0x4494, 19); // ld (iy+0x32),a

  m.ret(); // 4494
}
