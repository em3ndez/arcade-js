// SPDX-License-Identifier: GPL-3.0-only

// loc_43f0  (ROM 0x43F0-0x47B2)
export function loc_43f0(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  regs.ix = 0xa8a0;
  m.step(0x43f4, 14); // ld ix,0xa8a0
  regs.iy = 0xaa24;
  m.step(0x43f8, 14); // ld iy,0xaa24
  regs.a = mem.read8(X(0x00));
  m.step(0x43fb, 19); // ld a,(ix+0x00) -- the state byte
  regs.and(regs.a);
  m.step(0x43fc, 4); // and a

  if (regs.fZ) {
    m.step(0x4535, 10); // jp z,0x4535 (taken) -- state 0
    return loc_43f0_4535(m);
  }
  m.step(0x43ff, 10); // jp z,0x4535 (not taken)

  regs.a = regs.inc8(regs.a);
  m.step(0x4400, 4); // inc a -- Z only when the state was 0xFF
  if (regs.fNZ) {
    m.step(0x4540, 10); // jp nz,0x4540 (taken) -- A (= state+1) carries into C
    return loc_43f0_4540(m);
  }
  m.step(0x4403, 10); // jp nz,0x4540 (not taken)

  return loc_43f0_4403(m);
}

export function loc_43f0_4403(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.h = mem.read8(X(0x0c));
  m.step(0x4406, 19); // ld h,(ix+0x0c)
  regs.l = mem.read8(X(0x0d));
  m.step(0x4409, 19); // ld l,(ix+0x0d)
  regs.de = mem.read16(0xa808);
  m.step(0x440d, 20); // ld de,(0xa808)
  regs.addHl(regs.de);
  m.step(0x440e, 11); // add hl,de
  regs.d = mem.read8(Y(0x31));
  m.step(0x4411, 19); // ld d,(iy+0x31) -- the current coordinate
  regs.e = mem.read8(X(0x03));
  m.step(0x4414, 19); // ld e,(ix+0x03) -- and its remainder
  regs.addHl(regs.de);
  m.step(0x4415, 11); // add hl,de
  mem.write8(Y(0x31), regs.h);
  m.step(0x4418, 19); // ld (iy+0x31),h
  mem.write8(X(0x03), regs.l);
  m.step(0x441b, 19); // ld (ix+0x03),l

  regs.h = mem.read8(X(0x1c));
  m.step(0x441e, 19); // ld h,(ix+0x1c)
  regs.l = mem.read8(X(0x1d));
  m.step(0x4421, 19); // ld l,(ix+0x1d)
  regs.de = mem.read16(0xa80a);
  m.step(0x4425, 20); // ld de,(0xa80a)
  regs.addHl(regs.de);
  m.step(0x4426, 11); // add hl,de
  regs.d = mem.read8(Y(0x00));
  m.step(0x4429, 19); // ld d,(iy+0x00)
  regs.e = mem.read8(X(0x05));
  m.step(0x442c, 19); // ld e,(ix+0x05)
  regs.addHl(regs.de);
  m.step(0x442d, 11); // add hl,de
  mem.write8(Y(0x00), regs.h);
  m.step(0x4430, 19); // ld (iy+0x00),h
  mem.write8(X(0x05), regs.l);
  m.step(0x4433, 19); // ld (ix+0x05),l

  regs.a = mem.read8(Y(0x31));
  m.step(0x4436, 19); // ld a,(iy+0x31)
  regs.add(0x10);
  m.step(0x4438, 7); // add a,0x10
  mem.write8(Y(0x33), regs.a);
  m.step(0x443b, 19); // ld (iy+0x33),a -- the second sprite, offset by 0x10
  regs.a = mem.read8(Y(0x00));
  m.step(0x443e, 19); // ld a,(iy+0x00)
  mem.write8(Y(0x02), regs.a);
  m.step(0x4441, 19); // ld (iy+0x02),a

  m.push16(0x4444);
  m.step(0x4447, 17); // call 0x4447
  m.call(0x4447);

  m.step(0x46f0, 10); // jp 0x46f0
  return loc_43f0_46f0(m);
}

export function loc_43f0_4535(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(X(0x0e));
  m.step(0x4538, 19); // ld a,(ix+0x0e)
  regs.and(regs.a);
  m.step(0x4539, 4); // and a
  if (regs.fZ) {
    m.step(0x4663, 10); // jp z,0x4663 (taken) -- the delay has run out
    return loc_43f0_4663(m);
  }
  m.step(0x453c, 10); // jp z,0x4663 (not taken)

  regs.decMem8(mem, X(0x0e));
  m.step(0x453f, 23); // dec (ix+0x0e)
  m.ret(); // 453f  ret
}

export function loc_43f0_4540(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  regs.c = regs.a;
  m.step(0x4541, 4); // ld c,a -- C = state + 1
  regs.a = mem.read8(X(0x04));
  m.step(0x4544, 19); // ld a,(ix+0x04)
  regs.and(regs.a);
  m.step(0x4545, 4); // and a
  if (regs.fZ) {
    m.step(0x4554, 12); // jr z,0x4554 (taken)
    return loc_43f0_4554(m);
  }
  m.step(0x4547, 7); // jr z,0x4554 (not taken)

  regs.decMem8(mem, X(0x04));
  m.step(0x454a, 23); // dec (ix+0x04)
  mem.write8(X(0x00), 0xff);
  m.step(0x454e, 19); // ld (ix+0x00),0xff -- back to the live state
  m.push16(0x4551);
  m.step(0x5683, 17); // call 0x5683
  m.call(0x5683);

  m.step(0x4403, 10); // jp 0x4403 -- re-enter the integrator
  return loc_43f0_4403(m);
}

export function loc_43f0_4554(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = regs.c;
  m.step(0x4555, 4); // ld a,c
  regs.cp(0xf0);
  m.step(0x4557, 7); // cp 0xf0
  if (regs.fNZ) {
    m.step(0x45b3, 10); // jp nz,0x45b3 (taken)
    return loc_43f0_45b3(m);
  }
  m.step(0x455a, 10); // jp nz,0x45b3 (not taken)

  regs.xor(regs.a);
  m.step(0x455b, 4); // xor a
  mem.write8(0xa8dc, regs.a);
  m.step(0x455e, 13); // ld (0xa8dc),a
  m.push16(0x4561);
  m.step(0x5634, 17); // call 0x5634
  m.call(0x5634);
  m.push16(0x4564);
  m.step(0x56d2, 17); // call 0x56d2
  m.call(0x56d2);

  regs.hl = 0xa810;
  m.step(0x4567, 10); // ld hl,0xa810
  regs.de = 0x0010;
  m.step(0x456a, 10); // ld de,0x0010 -- the slot stride
  regs.b = 0x0f;
  m.step(0x456c, 7); // ld b,0x0f -- fifteen slots
  regs.c = 0x14;
  m.step(0x456e, 7); // ld c,0x14 -- the first code written

  do {
    regs.a = mem.read8(regs.hl);
    m.step(0x456f, 7); // ld a,(hl)
    regs.a = regs.inc8(regs.a);
    m.step(0x4570, 4); // inc a -- Z only when the slot held 0xFF
    if (regs.fNZ) {
      m.step(0x4594, 12); // jr nz,0x4594 (taken)

      regs.a = regs.inc8(regs.a);
      m.step(0x4595, 4); // inc a -- Z only when the slot held 0xFE
      if (regs.fNZ) {
        m.step(0x4579, 12); // jr nz,0x4579 (taken) -- leave the slot alone
      } else {
        m.step(0x4597, 7); // jr nz,0x4579 (not taken)
        mem.write8(regs.hl, 0x00);
        m.step(0x4599, 10); // ld (hl),0x00
        m.step(0x4579, 12); // jr 0x4579
      }
    } else {
      m.step(0x4572, 7); // jr nz,0x4594 (not taken)
      mem.write8(regs.hl, regs.c);
      m.step(0x4573, 7); // ld (hl),c
      regs.exx(); // the loop state parks in the main set
      m.step(0x4574, 4); // exx
      regs.de = 0x0402;
      m.step(0x4577, 10); // ld de,0x0402
      m.push16(0x4578);
      m.step(0x0038, 11); // rst 0x38 -- queue DE into the 0xAC00 ring
      m.call(0x0038);
      regs.exx();
      m.step(0x4579, 4); // exx
    }

    regs.addHl(regs.de);
    m.step(0x457a, 11); // add hl,de -- next slot
    regs.a = regs.c;
    m.step(0x457b, 4); // ld a,c
    regs.add(0x0a);
    m.step(0x457d, 7); // add a,0x0a
    regs.c = regs.a;
    m.step(0x457e, 4); // ld c,a
    regs.djnz();
    m.step(regs.b !== 0 ? 0x456e : 0x4580, regs.b !== 0 ? 13 : 8); // djnz 0x456e
  } while (regs.b !== 0);

  regs.c = 0x3c;
  m.step(0x4582, 7); // ld c,0x3c
  regs.a = 0xfe;
  m.step(0x4584, 7); // ld a,0xfe
  mem.write8(0xacc6, regs.a);
  m.step(0x4587, 13); // ld (0xacc6),a
  mem.write8(X(0x00), 0xe4);
  m.step(0x458b, 19); // ld (ix+0x00),0xe4
  mem.write8(Y(0x30), 0x3d);
  m.step(0x458f, 19); // ld (iy+0x30),0x3d
  mem.write8(Y(0x32), 0x3d);
  m.step(0x4593, 19); // ld (iy+0x32),0x3d
  m.ret(); // 4593  ret
}

export function loc_43f0_45b3(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  m.push16(0x45b6);
  m.step(0x2b60, 17); // call 0x2b60
  m.call(0x2b60);

  to45dd: {
    to45d5: {
      regs.a = mem.read8(Y(0x31));
      m.step(0x45b9, 19); // ld a,(iy+0x31)
      regs.b = regs.a;
      m.step(0x45ba, 4); // ld b,a
      regs.add(0x13);
      m.step(0x45bc, 7); // add a,0x13
      regs.cp(0x03);
      m.step(0x45be, 7); // cp 0x03
      if (regs.fC) {
        m.step(0x45d5, 12); // jr c,0x45d5 (taken) -- (iy+0x31) in 0xED..0xEF
        break to45d5;
      }
      m.step(0x45c0, 7); // jr c,0x45d5 (not taken)

      regs.a = regs.b;
      m.step(0x45c1, 4); // ld a,b
      regs.add(0x10);
      m.step(0x45c3, 7); // add a,0x10
      mem.write8(Y(0x33), regs.a);
      m.step(0x45c6, 19); // ld (iy+0x33),a
      regs.a = mem.read8(Y(0x00));
      m.step(0x45c9, 19); // ld a,(iy+0x00)
      regs.b = regs.a;
      m.step(0x45ca, 4); // ld b,a
      regs.add(0x08);
      m.step(0x45cc, 7); // add a,0x08
      regs.cp(0x28);
      m.step(0x45ce, 7); // cp 0x28
      if (regs.fC) {
        m.step(0x45d5, 12); // jr c,0x45d5 (taken) -- 8-bit: (iy+0x00) + 8 < 0x28
        break to45d5;
      }
      m.step(0x45d0, 7); // jr c,0x45d5 (not taken)

      mem.write8(Y(0x02), regs.b);
      m.step(0x45d3, 19); // ld (iy+0x02),b
      m.step(0x45dd, 12); // jr 0x45dd
      break to45dd;
    }

    mem.write8(Y(0x01), 0xff);
    m.step(0x45d9, 19); // ld (iy+0x01),0xff
    mem.write8(Y(0x03), 0xff);
    m.step(0x45dd, 19); // ld (iy+0x03),0xff
  }

  regs.a = mem.read8(X(0x00));
  m.step(0x45e0, 19); // ld a,(ix+0x00)
  regs.cp(0xb4);
  m.step(0x45e2, 7); // cp 0xb4
  if (regs.fZ) {
    m.step(0x4623, 12); // jr z,0x4623 (taken)
    return loc_43f0_4623(m);
  }
  m.step(0x45e4, 7); // jr z,0x4623 (not taken)

  if (regs.fC) {
    m.step(0x45f9, 12); // jr c,0x45f9 (taken) -- state < 0xb4
  } else {
    m.step(0x45e6, 7); // jr c,0x45f9 (not taken)
    regs.sub(0xb4);
    m.step(0x45e8, 7); // sub 0xb4
    regs.rrca();
    m.step(0x45e9, 4); // rrca
    regs.rrca();
    m.step(0x45ea, 4); // rrca
    regs.rrca();
    m.step(0x45eb, 4); // rrca -- (state - 0xB4) / 8
    regs.a = regs.dec8(regs.a);
    m.step(0x45ec, 4); // dec a
    regs.and(0x07);
    m.step(0x45ee, 7); // and 0x07 -- an eight-frame cycle
    regs.hl = 0x461b;
    m.step(0x45f1, 10); // ld hl,0x461b -- the 8-byte ROM table
    m.push16(0x45f2);
    m.step(0x0008, 11); // rst 0x08 -- A = table[A]
    m.call(0x0008);
    mem.write8(Y(0x03), regs.a);
    m.step(0x45f5, 19); // ld (iy+0x03),a
    regs.a = regs.inc8(regs.a);
    m.step(0x45f6, 4); // inc a
    mem.write8(Y(0x01), regs.a);
    m.step(0x45f9, 19); // ld (iy+0x01),a -- one more than the cell above
  }

  regs.decMem8(mem, X(0x00));
  m.step(0x45fc, 23); // dec (ix+0x00)
  if (regs.fZ) {
    m.step(0x4646, 10); // jp z,0x4646 (taken) -- the sequence is over
    return loc_43f0_4646(m);
  }
  m.step(0x45ff, 10); // jp z,0x4646 (not taken)

  regs.a = mem.read8(X(0x00));
  m.step(0x4602, 19); // ld a,(ix+0x00)
  regs.cp(0x5a);
  m.step(0x4604, 7); // cp 0x5a
  if (regs.fNZ) {
    m.ret(11); // ret nz (taken)
    return;
  }
  m.step(0x4605, 5); // ret nz (not taken)

  mem.write8(Y(0x01), 0xff);
  m.step(0x4609, 19); // ld (iy+0x01),0xff
  mem.write8(Y(0x03), 0xff);
  m.step(0x460d, 19); // ld (iy+0x03),0xff
  m.ret(); // 460d  ret
}

export function loc_43f0_4623(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.decMem8(mem, X(0x00));
  m.step(0x4626, 23); // dec (ix+0x00)
  mem.write8(Y(0x01), 0xfe);
  m.step(0x462a, 19); // ld (iy+0x01),0xfe
  mem.write8(Y(0x03), 0xfd);
  m.step(0x462e, 19); // ld (iy+0x03),0xfd
  mem.write8(Y(0x30), 0x6c);
  m.step(0x4632, 19); // ld (iy+0x30),0x6c
  mem.write8(Y(0x32), 0x6c);
  m.step(0x4636, 19); // ld (iy+0x32),0x6c

  regs.a = mem.read8(0xa800);
  m.step(0x4639, 13); // ld a,(0xa800)
  regs.a = regs.inc8(regs.a);
  m.step(0x463a, 4); // inc a
  if (regs.fZ) {
    m.push16(0x463d);
    m.step(0x580b, 17); // call z,0x580b (taken)
    m.call(0x580b);
  } else {
    m.step(0x463d, 10); // call z,0x580b (not taken)
  }

  regs.de = 0x040d;
  m.step(0x4640, 10); // ld de,0x040d
  m.step(0x0038, 10); // jp 0x0038 -- TAIL
  return m.call(0x0038);
}

export function loc_43f0_4646(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  regs.a = 0xff;
  m.step(0x4648, 7); // ld a,0xff
  mem.write8(0xacc6, regs.a);
  m.step(0x464b, 13); // ld (0xacc6),a
  mem.write8(X(0x00), 0x00);
  m.step(0x464f, 19); // ld (ix+0x00),0x00 -- back to the idle state
  regs.hl = 0xab43;
  m.step(0x4652, 10); // ld hl,0xab43
  regs.a = mem.read8(regs.hl);
  m.step(0x4653, 7); // ld a,(hl)
  regs.cp(0x7c);
  m.step(0x4655, 7); // cp 0x7c

  if (regs.fZ) {
    m.step(0x4658, 10); // jp nz,0x4660 (not taken)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4659, 6); // inc hl -- 0xAB44
    regs.a = mem.read8(regs.hl);
    m.step(0x465a, 7); // ld a,(hl)
    regs.cp(0x10);
    m.step(0x465c, 7); // cp 0x10
    if (regs.fZ) {
      m.ret(11); // ret z (taken)
      return;
    }
    m.step(0x465d, 5); // ret z (not taken)
    regs.cp(0x05);
    m.step(0x465f, 7); // cp 0x05
    if (regs.fZ) {
      m.ret(11); // ret z (taken)
      return;
    }
    m.step(0x4660, 5); // ret z (not taken)
  } else {
    m.step(0x4660, 10); // jp nz,0x4660 (taken)
  }

  m.step(0x459b, 10); // jp 0x459b
  return m.call(0x459b);
}

export function loc_43f0_4663(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(0xacc6);
  m.step(0x4666, 13); // ld a,(0xacc6)
  regs.and(regs.a);
  m.step(0x4667, 4); // and a
  if (regs.fNZ) {
    m.ret(11); // ret nz (taken) -- locked out
    return;
  }
  m.step(0x4668, 5); // ret nz (not taken)

  regs.a = mem.read8(0xa802);
  m.step(0x466b, 13); // ld a,(0xa802)
  regs.b = regs.a;
  m.step(0x466c, 4); // ld b,a
  regs.a = mem.read8(0xa980);
  m.step(0x466f, 13); // ld a,(0xa980) -- the frame counter
  regs.c = regs.a;
  m.step(0x4670, 4); // ld c,a
  regs.a = 0x10;
  m.step(0x4672, 7); // ld a,0x10
  regs.bit(3, regs.c);
  m.step(0x4674, 8); // bit 3,c
  if (regs.fNZ) {
    m.step(0x4678, 12); // jr nz,0x4678 (taken) -- keep +0x10
  } else {
    m.step(0x4676, 7); // jr nz,0x4678 (not taken)
    regs.neg(); // A = -0x10
    m.step(0x4678, 8); // neg
  }

  regs.add(regs.b);
  m.step(0x4679, 4); // add a,b
  regs.rrca();
  m.step(0x467a, 4); // rrca
  regs.rrca();
  m.step(0x467b, 4); // rrca
  regs.and(0x3e);
  m.step(0x467d, 7); // and 0x3e -- an even index into the word table
  regs.hl = 0x3c84;
  m.step(0x4680, 10); // ld hl,0x3c84
  m.push16(0x4681);
  m.step(0x0008, 11); // rst 0x08 -- A = table[A], HL left on that byte
  m.call(0x0008);
  mem.write8(Y(0x31), regs.a);
  m.step(0x4684, 19); // ld (iy+0x31),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4685, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x4686, 7); // ld a,(hl)
  mem.write8(Y(0x00), regs.a);
  m.step(0x4689, 19); // ld (iy+0x00),a

  regs.a = regs.b;
  m.step(0x468a, 4); // ld a,b
  regs.add(0xc0);
  m.step(0x468c, 7); // add a,0xc0
  regs.and(0x80);
  m.step(0x468e, 7); // and 0x80 -- one facing bit out of (0xA802)
  mem.write8(X(0x02), regs.a);
  m.step(0x4691, 19); // ld (ix+0x02),a

  m.push16(0x4694);
  m.step(0x46ba, 17); // call 0x46ba -- the per-stage dispatch
  m.call(0x46ba);

  regs.a = mem.read8(X(0x04));
  m.step(0x4697, 19); // ld a,(ix+0x04)
  regs.cp(0x06);
  m.step(0x4699, 7); // cp 0x06
  if (regs.fNC) {
    m.step(0x469f, 12); // jr nc,0x469f (taken)
  } else {
    m.step(0x469b, 7); // jr nc,0x469f (not taken)
    mem.write8(X(0x04), 0x05);
    m.step(0x469f, 19); // ld (ix+0x04),0x05 -- floor the counter at 5
  }

  mem.write8(X(0x00), 0xff);
  m.step(0x46a3, 19); // ld (ix+0x00),0xff -- go live
  m.step(0x57f7, 10); // jp 0x57f7 -- TAIL into a separate routine
  return m.call(0x57f7);
}

export function loc_43f0_46f0(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(X(0x00));
  m.step(0x46f3, 19); // ld a,(ix+0x00)
  regs.a = regs.inc8(regs.a);
  m.step(0x46f4, 4); // inc a
  if (regs.fNZ) {
    m.ret(11); // ret nz (taken) -- not live
    return;
  }
  m.step(0x46f5, 5); // ret nz (not taken)

  regs.a = mem.read8(0xa817);
  m.step(0x46f8, 13); // ld a,(0xa817)
  regs.and(regs.a);
  m.step(0x46f9, 4); // and a
  if (regs.fNZ) {
    m.ret(11); // ret nz (taken) -- still cooling down
    return;
  }
  m.step(0x46fa, 5); // ret nz (not taken)

  regs.b = 0x02;
  m.step(0x46fc, 7); // ld b,0x02 -- two slots
  regs.a = mem.read8(0xa827);
  m.step(0x46ff, 13); // ld a,(0xa827)
  regs.d = regs.a;
  m.step(0x4700, 4); // ld d,a -- the half-width
  regs.add(regs.a);
  m.step(0x4701, 4); // add a,a
  regs.e = regs.a;
  m.step(0x4702, 4); // ld e,a -- twice it

  do {
    advance: {
      regs.a = mem.read8(Y(0x00));
      m.step(0x4705, 19); // ld a,(iy+0x00)
      regs.add(0x08);
      m.step(0x4707, 7); // add a,0x08
      regs.cp(0x28);
      m.step(0x4709, 7); // cp 0x28
      if (regs.fC) {
        m.step(0x4726, 12); // jr c,0x4726 (taken)
        break advance;
      }
      m.step(0x470b, 7); // jr c,0x4726 (not taken)

      regs.a = mem.read8(Y(0x31));
      m.step(0x470e, 19); // ld a,(iy+0x31)
      regs.add(0x10);
      m.step(0x4710, 7); // add a,0x10
      regs.cp(0x20);
      m.step(0x4712, 7); // cp 0x20
      if (regs.fC) {
        m.step(0x4726, 12); // jr c,0x4726 (taken)
        break advance;
      }
      m.step(0x4714, 7); // jr c,0x4726 (not taken)

      regs.a = 0x84;
      m.step(0x4716, 7); // ld a,0x84
      regs.sub(mem.read8(Y(0x00)));
      m.step(0x4719, 19); // sub (iy+0x00)
      regs.add(regs.d);
      m.step(0x471a, 4); // add a,d
      regs.cp(regs.e);
      m.step(0x471b, 4); // cp e
      if (regs.fNC) {
        m.step(0x4734, 12); // jr nc,0x4734 (taken)
        return loc_43f0_4734(m);
      }
      m.step(0x471d, 7); // jr nc,0x4734 (not taken)

      regs.a = 0x78;
      m.step(0x471f, 7); // ld a,0x78
      regs.sub(mem.read8(Y(0x31)));
      m.step(0x4722, 19); // sub (iy+0x31)
      regs.add(regs.d);
      m.step(0x4723, 4); // add a,d
      regs.cp(regs.e);
      m.step(0x4724, 4); // cp e
      if (regs.fNC) {
        m.step(0x4734, 12); // jr nc,0x4734 (taken)
        return loc_43f0_4734(m);
      }
      m.step(0x4726, 7); // jr nc,0x4734 (not taken)
    }

    regs.exx();
    m.step(0x4727, 4); // exx
    regs.de = 0x0010;
    m.step(0x472a, 10); // ld de,0x0010
    regs.addIx(regs.de);
    m.step(0x472c, 15); // add ix,de
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x472e, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x4730, 10); // inc iy
    regs.exx();
    m.step(0x4731, 4); // exx
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4702 : 0x4733, regs.b !== 0 ? 13 : 8); // djnz 0x4702
  } while (regs.b !== 0);

  m.ret(); // 4733  ret
}

export function loc_43f0_4734(m) {
  const { regs, mem } = m;

  regs.hl = 0xa830;
  m.step(0x4737, 10); // ld hl,0xa830
  regs.exx();
  m.step(0x4738, 4); // exx
  regs.hl = 0xaa16;
  m.step(0x473b, 10); // ld hl,0xaa16
  regs.b = 0x02;
  m.step(0x473d, 7); // ld b,0x02 -- the counter stays in the shadow set

  do {
    regs.exx();
    m.step(0x473e, 4); // exx -- back to the 0xA830 pointer
    regs.a = mem.read8(regs.hl);
    m.step(0x473f, 7); // ld a,(hl)
    regs.and(regs.a);
    m.step(0x4740, 4); // and a
    if (regs.fZ) {
      m.step(0x474c, 12); // jr z,0x474c (taken) -- a free entry
      return loc_43f0_474c(m);
    }
    m.step(0x4742, 7); // jr z,0x474c (not taken)

    regs.de = 0x0010;
    m.step(0x4745, 10); // ld de,0x0010
    regs.addHl(regs.de);
    m.step(0x4746, 11); // add hl,de
    regs.exx();
    m.step(0x4747, 4); // exx
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4748, 6); // inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4749, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x473d : 0x474b, regs.b !== 0 ? 13 : 8); // djnz 0x473d
  } while (regs.b !== 0);

  m.ret(); // 474b  ret
}

export function loc_43f0_474c(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  mem.write16(0xa991, regs.hl);
  m.step(0x474f, 16); // ld (0xa991),hl -- the 0xA830 entry
  regs.exx();
  m.step(0x4750, 4); // exx
  mem.write16(0xa993, regs.hl);
  m.step(0x4753, 16); // ld (0xa993),hl -- the matching 0xAA16 entry

  m.push16(0x4756);
  m.step(0x565f, 17); // call 0x565f
  m.call(0x565f);

  regs.hl = 0xac7f;
  m.step(0x4759, 10); // ld hl,0xac7f
  m.push16(0x475c);
  m.step(0x33b8, 17); // call 0x33b8 -- returns a byte in A
  m.call(0x33b8);

  regs.h = regs.a;
  m.step(0x475d, 4); // ld h,a
  regs.exDeHl();
  m.step(0x475e, 4); // ex de,hl -- park it in DE
  regs.hl = 0xa8b4;
  m.step(0x4761, 10); // ld hl,0xa8b4
  regs.incMem8(mem, regs.hl);
  m.step(0x4762, 11); // inc (hl) -- the alternating toggle
  regs.a = 0x18;
  m.step(0x4764, 7); // ld a,0x18
  regs.bit(0, mem.read8(regs.hl));
  m.step(0x4766, 12); // bit 0,(hl)
  if (regs.fNZ) {
    m.step(0x476a, 12); // jr nz,0x476a (taken) -- keep +0x18
  } else {
    m.step(0x4768, 7); // jr nz,0x476a (not taken)
    regs.neg(); // A = -0x18
    m.step(0x476a, 8); // neg
  }

  regs.exDeHl();
  m.step(0x476b, 4); // ex de,hl -- H is the 0x33B8 byte again
  regs.add(regs.h);
  m.step(0x476c, 4); // add a,h
  regs.b = mem.read8(Y(0x31));
  m.step(0x476f, 19); // ld b,(iy+0x31) -- the source's coordinates
  regs.c = mem.read8(Y(0x00));
  m.step(0x4772, 19); // ld c,(iy+0x00)
  regs.ix = mem.read16(0xa991);
  m.step(0x4776, 20); // ld ix,(0xa991) -- retarget at the new entry
  regs.iy = mem.read16(0xa993);
  m.step(0x477a, 20); // ld iy,(0xa993)
  mem.write8(X(0x02), regs.a);
  m.step(0x477d, 19); // ld (ix+0x02),a -- the heading
  mem.write8(Y(0x31), regs.b);
  m.step(0x4780, 19); // ld (iy+0x31),b
  mem.write8(Y(0x00), regs.c);
  m.step(0x4783, 19); // ld (iy+0x00),c

  regs.hl = 0x4795;
  m.step(0x4786, 10); // ld hl,0x4795
  m.push16(regs.hl);
  m.step(0x4787, 11); // push hl -- the arm rets to 0x4795, just below
  regs.a = mem.read8(0xad04);
  m.step(0x478a, 13); // ld a,(0xad04) -- the stage

  m.push16(0x478b); // rst 0x30 pushes the address AFTER it -- the table base
  m.step(0x0030, 11); // rst 0x30
  m.call(0x0030, "0x478b ((0xad04) stage)"); // inline jump table dispatch

  mem.write8(X(0x0a), regs.e);
  m.step(0x4798, 19); // ld (ix+0x0a),e
  mem.write8(X(0x0b), regs.d);
  m.step(0x479b, 19); // ld (ix+0x0b),d
  mem.write8(X(0x0c), regs.c);
  m.step(0x479e, 19); // ld (ix+0x0c),c
  mem.write8(X(0x0d), regs.b);
  m.step(0x47a1, 19); // ld (ix+0x0d),b
  mem.write8(Y(0x01), 0x4d);
  m.step(0x47a5, 19); // ld (iy+0x01),0x4d
  mem.write8(Y(0x30), 0x62);
  m.step(0x47a9, 19); // ld (iy+0x30),0x62
  regs.decMem8(mem, X(0x00));
  m.step(0x47ac, 23); // dec (ix+0x00) -- 0x00 -> 0xFF: the entry is live
  regs.a = mem.read8(0xa814);
  m.step(0x47af, 13); // ld a,(0xa814)
  mem.write8(0xa817, regs.a);
  m.step(0x47b2, 13); // ld (0xa817),a -- re-arm the cooldown
  m.ret(); // 47b2  ret
}
