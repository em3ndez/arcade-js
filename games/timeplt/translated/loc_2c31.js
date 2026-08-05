// SPDX-License-Identifier: GPL-3.0-only

// loc_2c31  (ROM 0x2C31-0x2C93)
export function loc_2c31(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(X(0x00));
  m.step(0x2c34, 19); // ld a,(ix+0x00)
  regs.cp(0x2a);
  m.step(0x2c36, 7); // cp 0x2a

  if (regs.fNC) {
    m.step(0x2c71, 10); // jp nc,0x2c71 (taken)

    regs.a = mem.read8(Y(0x30));
    m.step(0x2c74, 19); // ld a,(iy+0x30)
    regs.c = regs.a;
    m.step(0x2c75, 4); // ld c,a
    regs.and(0xc0);
    m.step(0x2c77, 7); // and 0xc0
    regs.b = regs.a;
    m.step(0x2c78, 4); // ld b,a
    regs.a = mem.read8(0xa980);
    m.step(0x2c7b, 13); // ld a,(0xa980)
    regs.and(0x0f);
    m.step(0x2c7d, 7); // and 0x0f
    regs.add(regs.b);
    m.step(0x2c7e, 4); // add a,b
    mem.write8(Y(0x30), regs.a);
    m.step(0x2c81, 19); // ld (iy+0x30),a
    m.ret(10); // 2c81  ret
    return;
  }
  m.step(0x2c39, 10); // jp nc,0x2c71 (not taken)

  regs.cp(0x0a);
  m.step(0x2c3b, 7); // cp 0x0a

  if (regs.fNC) {
    m.step(0x2c82, 12); // jr nc,0x2c82 (taken)

    regs.sub(0x0a);
    m.step(0x2c84, 7); // sub 0x0a
    regs.rrca();
    m.step(0x2c85, 4); // rrca
    regs.and(0x0f);
    m.step(0x2c87, 7); // and 0x0f
    regs.b = regs.a;
    m.step(0x2c88, 4); // ld b,a
    regs.hl = 0x2c94;
    m.step(0x2c8b, 10); // ld hl,0x2c94

    m.push16(0x2c8c);
    m.step(0x0008, 11); // rst 0x08 -- A = (HL + A)
    m.call(0x0008);

    mem.write8(Y(0x01), regs.a);
    m.step(0x2c8f, 19); // ld (iy+0x01),a
    mem.write8(Y(0x30), 0x3c);
    m.step(0x2c93, 19); // ld (iy+0x30),0x3c
    m.ret(10); // 2c93  ret
    return;
  }
  m.step(0x2c3d, 7); // jr nc,0x2c82 (not taken)

  regs.a = mem.read8(0xa821);
  m.step(0x2c40, 13); // ld a,(0xa821)
  regs.bit(7, regs.a);
  m.step(0x2c42, 8); // bit 7,a

  if (regs.fZ) {
    m.step(0x2bde, 10); // jp z,0x2bde (taken) -- TAIL, nothing pushed
    return m.call(0x2bde);
  }
  m.step(0x2c45, 10); // jp z,0x2bde (not taken)

  regs.a = mem.read8(0xa821);
  m.step(0x2c48, 13); // ld a,(0xa821)
  regs.a = regs.res(7, regs.a);
  m.step(0x2c4a, 8); // res 7,a -- no flags
  regs.cp(mem.read8(X(0x0f)));
  m.step(0x2c4d, 19); // cp (ix+0x0f)

  if (regs.fNZ) {
    m.step(0x2bde, 10); // jp nz,0x2bde (taken) -- TAIL, nothing pushed
    return m.call(0x2bde);
  }
  m.step(0x2c50, 10); // jp nz,0x2bde (not taken)

  regs.a = mem.read8(0xa980);
  m.step(0x2c53, 13); // ld a,(0xa980)
  regs.and(0x07);
  m.step(0x2c55, 7); // and 0x07

  if (regs.fZ) {
    m.step(0x2c5a, 12); // jr z,0x2c5a (taken) -- one frame in 8, hold the phase
  } else {
    m.step(0x2c57, 7); // jr z,0x2c5a (not taken)
    regs.incMem8(mem, X(0x00));
    m.step(0x2c5a, 23); // inc (ix+0x00)
  }

  mem.write8(Y(0x01), 0xfc);
  m.step(0x2c5e, 19); // ld (iy+0x01),0xfc
  mem.write8(Y(0x30), 0x6c);
  m.step(0x2c62, 19); // ld (iy+0x30),0x6c
  regs.a = mem.read8(X(0x00));
  m.step(0x2c65, 19); // ld a,(ix+0x00)
  regs.cp(0x01);
  m.step(0x2c67, 7); // cp 0x01

  if (regs.fNZ) {
    m.ret(11); // ret nz (taken) -- only phase 1 does the one-shot below
    return;
  }
  m.step(0x2c68, 5); // ret nz (not taken)

  regs.de = 0x040c;
  m.step(0x2c6b, 10); // ld de,0x040c

  m.push16(0x2c6c);
  m.step(0x0038, 11); // rst 0x38 -- enqueue DE into the 0xAC00 ring
  m.call(0x0038);

  regs.xor(regs.a);
  m.step(0x2c6d, 4); // xor a
  mem.write8(0xa821, regs.a);
  m.step(0x2c70, 13); // ld (0xa821),a -- request consumed
  m.ret(10); // 2c70  ret
}
