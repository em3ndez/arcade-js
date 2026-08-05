// SPDX-License-Identifier: GPL-3.0-only

// loc_15ca  (ROM 0x15CA-0x15E1, then falls into loc_15e2)
export function loc_15ca(m) {
  const { regs, mem } = m;

  regs.e = regs.a;
  m.step(0x15cb, 4); // 15ca  ld e,a
  regs.and(regs.l);
  m.step(0x15cc, 4); // 15cb  and l
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x15cd, 6); // 15cc  inc de -- 16-bit, no flags
  mem.write8(regs.hl, regs.a);
  m.step(0x15ce, 7); // 15cd  ld (hl),a -- HL is whatever the trap arrived with

  m.push16(0x15cf);
  m.step(0x0010, 11); // 15ce  rst 0x10 -- word from the table at HL indexed by A
  m.call(0x0010);

  regs.incMem8(mem, regs.hl);
  m.step(0x15d0, 11); // 15cf  inc (hl)
  regs.add(regs.a);
  m.step(0x15d1, 4); // 15d0  add a,a -- sets the carry the next call tests

  if (regs.fC) {
    m.push16(0x15d5);
    m.step(0xfeb9, 21); // 15d1  [fd] call c,0xfeb9 taken -- unmapped space
    m.call(0xfeb9);
  } else {
    m.step(0x15d5, 14); // 15d1  [fd] call c,0xfeb9 not taken
  }

  regs.d = regs.dec8(regs.d);
  m.step(0x15d6, 4); // 15d5  dec d
  regs.h = regs.b;
  m.step(0x15d7, 4); // 15d6  ld h,b
  regs.and(mem.read8(regs.hl));
  m.step(0x15d8, 7); // 15d7  and (hl)
  regs.d = regs.inc8(regs.d);
  m.step(0x15d9, 4); // 15d8  inc d -- sets the Z the next call tests

  if (regs.fNZ) {
    m.push16(0x15dc);
    m.step(0x10fd, 17); // 15d9  call nz,0x10fd taken -- inside loc_10f8
    m.call(0x10fd);
  } else {
    m.step(0x15dc, 10); // 15d9  call nz,0x10fd not taken
  }

  m.step(0x15de, 8); // 15dc  ed 77 -- undefined ED opcode, a 2-byte nop
  regs.l = regs.b;
  m.step(0x15df, 4); // 15de  ld l,b

  m.push16(0x15e0);
  m.step(0x0010, 11); // 15df  rst 0x10
  m.call(0x0010);

  regs.incMem8(mem, regs.hl);
  m.step(0x15e1, 11); // 15e0  inc (hl)
  regs.cp(regs.c);
  m.step(0x15e2, 4); // 15e1  cp c

  return m.call(0x15e2);
}
