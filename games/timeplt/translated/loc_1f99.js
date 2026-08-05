// SPDX-License-Identifier: GPL-3.0-only

// loc_1f99  (ROM 0x1F99-0x1FE1, Time Pilot)
export function loc_1f99(m) {
  const { regs, mem } = m;

  regs.af = m.pop16();
  m.step(0x1f9a, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1f9b, 10); // pop af
  regs.c = regs.l;
  m.step(0x1f9c, 4); // ld c,l
  regs.af = m.pop16();
  m.step(0x1f9d, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1f9e, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1f9f, 10); // pop af
  m.push16(regs.hl);
  m.step(0x1fa0, 11); // push hl
  regs.l = regs.dec8(regs.l);
  m.step(0x1fa1, 4); // dec l -- 8-bit, sets flags
  regs.l = mem.read8(regs.hl);
  m.step(0x1fa2, 7); // ld l,(hl)
  regs.af = m.pop16();
  m.step(0x1fa3, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fa4, 10); // pop af
  regs.e = mem.read8(regs.hl);
  m.step(0x1fa5, 7); // ld e,(hl)
  regs.h = regs.c;
  m.step(0x1fa6, 4); // ld h,c
  regs.and(0xf1);
  m.step(0x1fa8, 7); // and 0xf1
  regs.af = m.pop16();
  m.step(0x1fa9, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1faa, 10); // pop af
  regs.or(regs.d);
  m.step(0x1fab, 4); // or d
  regs.af = m.pop16();
  m.step(0x1fac, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fad, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fae, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1faf, 10); // pop af
  regs.d = regs.e;
  m.step(0x1fb0, 4); // ld d,e
  regs.af = m.pop16();
  m.step(0x1fb1, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fb2, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fb3, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fb4, 10); // pop af
  regs.sub(regs.l);
  m.step(0x1fb5, 4); // sub l
  regs.af = m.pop16();
  m.step(0x1fb6, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fb7, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fb8, 10); // pop af
  regs.b = regs.l;
  m.step(0x1fb9, 4); // ld b,l

  if (regs.fZ) {
    m.step(0xf1f1, 10); // jp z,0xf1f1 (taken) -- off the map
    return m.call(0xf1f1);
  }
  m.step(0x1fbc, 10); // jp z,0xf1f1 (not taken; jp costs 10 either way)

  regs.af = m.pop16();
  m.step(0x1fbd, 10); // pop af
  regs.add(0x2c);
  m.step(0x1fbf, 7); // add a,0x2c
  regs.sub(regs.a);
  m.step(0x1fc0, 4); // sub a -- A = 0
  regs.af = m.pop16();
  m.step(0x1fc1, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fc2, 10); // pop af
  regs.add(regs.c);
  m.step(0x1fc3, 4); // add a,c
  regs.l = regs.c;
  m.step(0x1fc4, 4); // ld l,c
  regs.e = 0xf1;
  m.step(0x1fc6, 7); // ld e,0xf1
  regs.af = m.pop16();
  m.step(0x1fc7, 10); // pop af
  regs.cp(regs.h);
  m.step(0x1fc8, 4); // cp h
  regs.and(regs.c);
  m.step(0x1fc9, 4); // and c
  regs.h = regs.b;
  m.step(0x1fca, 4); // ld h,b
  regs.af = m.pop16();
  m.step(0x1fcb, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fcc, 10); // pop af

  if (regs.fP) {
    m.push16(0x1fcf);
    m.step(0xf1eb, 17); // call p,0xf1eb (taken) -- off the map
    m.call(0xf1eb);
  } else {
    m.step(0x1fcf, 10); // call p,0xf1eb (not taken)
  }

  regs.af = m.pop16();
  m.step(0x1fd0, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fd1, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fd2, 10); // pop af
  regs.c = regs.b;
  m.step(0x1fd3, 4); // ld c,b
  regs.af = m.pop16();
  m.step(0x1fd4, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fd5, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fd6, 10); // pop af

  if (regs.fPO) {
    m.ret(11); // 1fd6  ret po (taken)
    return;
  }
  m.step(0x1fd7, 5); // ret po (not taken)

  regs.h = regs.e;
  m.step(0x1fd8, 4); // ld h,e
  regs.decMem8(mem, regs.hl);
  m.step(0x1fd9, 11); // dec (hl)
  regs.af = m.pop16();
  m.step(0x1fda, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fdb, 10); // pop af
  regs.xor(regs.d);
  m.step(0x1fdc, 4); // xor d
  regs.or(regs.h);
  m.step(0x1fdd, 4); // or h
  regs.adc(regs.d);
  m.step(0x1fde, 4); // adc a,d
  regs.af = m.pop16();
  m.step(0x1fdf, 10); // pop af
  regs.af = m.pop16();
  m.step(0x1fe0, 10); // pop af
  regs.d = regs.c;
  m.step(0x1fe1, 4); // ld d,c

  const target = regs.hl;
  m.step(target, 4); // jp (hl) -- unresolved computed jump
  return m.call(target);
}
