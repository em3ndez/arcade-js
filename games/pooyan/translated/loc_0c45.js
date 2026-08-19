// SPDX-License-Identifier: GPL-3.0-only
//
// ROM range 0x0c45-0x0cf7 = four entry points the batch range lumped under "loc_0c45": loc_0c45 (word
// lookup helper, 36 callers), loc_0c4e (state dispatcher), loc_0c5c (state 0), loc_0c77 (state 1).
// 0c4e/0c5c/0c77 are reached via the 0x06f4 vector table and the rst-0x28 table at 0x0c56, not by
// direct call. Un-annotated instruction addresses = the previous m.step's nextAddr arg.

// loc_0c45 -- A=index, HL=table base -> DE = table[index] (LE word); HL := base+2*index+1.
export function loc_0c45(m) {
  const { regs, mem } = m;

  regs.add(regs.a);
  m.step(0x0c46, 4); // 0c45  add a,a -- A=index*2 (C set if index>0x7f)
  regs.d = 0x00;
  m.step(0x0c48, 7);
  regs.e = regs.a;
  m.step(0x0c49, 4);
  regs.addHl(regs.de);
  m.step(0x0c4a, 11); // 0c49  add hl,de
  regs.e = mem.read8(regs.hl);
  m.step(0x0c4b, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c4c, 6);
  regs.d = mem.read8(regs.hl);
  m.step(0x0c4d, 7);
  m.ret(); // 0c4d  ret -- DE = table[index]
}

// loc_0c4e -- push a fixed return (0x0d78), then dispatch on state byte (0x880a) via loc_0028,
// which indexes the inline word table at 0x0c56 {0->0c5c, 1->0c77, 2->0d61} and jumps there.
export function loc_0c4e(m) {
  const { regs, mem } = m;

  regs.hl = 0x0d78;
  m.step(0x0c51, 10);
  m.push16(regs.hl);
  m.step(0x0c52, 11); // 0c51  push hl -- handler's ret lands on 0x0d78
  regs.a = mem.read8(0x880a);
  m.step(0x0c55, 13); // 0c52  ld a,(0x880a)
  m.push16(0x0c56);
  m.step(0x0028, 11); // 0c55  rst 0x28 -- pushes table base 0x0c56; loc_0028 performs the jump
  return m.call(0x0028);
}

// loc_0c5c -- state 0: clear scratch bytes, seat the tile pointer (0x8442), bump state, delegate.
export function loc_0c5c(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x0c5d, 4); // 0c5c  xor a
  mem.write8(0x8819, regs.a);
  m.step(0x0c60, 13);
  mem.write8(0xa028, regs.a);
  m.step(0x0c63, 13); // 0c60  ld (0xa028),a -- decodes to watchdog kick
  mem.write8(0x8806, regs.a);
  m.step(0x0c66, 13);
  regs.hl = 0x8442;
  m.step(0x0c69, 10);
  mem.write16(0x880b, regs.hl);
  m.step(0x0c6c, 16);
  regs.hl = 0x8809;
  m.step(0x0c6f, 10);
  mem.write8(regs.hl, 0x0f);
  m.step(0x0c71, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c72, 6);
  regs.incMem8(mem, regs.hl);
  m.step(0x0c73, 11); // 0c72  inc (hl) -- (0x880a) state -> 1
  m.push16(0x0c76);
  m.step(0x02b9, 17); // 0c73  call 0x02b9
  m.call(0x02b9);
  m.ret(); // 0c76  ret
}

// loc_0c77 -- state 1: two 0x1d-byte tile fills (rst 0x10 = fill B at (HL); HL+=B, B=0). Once the
// (0x8809) countdown hits zero, advance state and run the board-intro build (ROM checksum + calls).
export function loc_0c77(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x880b);
  m.step(0x0c7a, 16); // 0c77  ld hl,(0x880b)
  regs.b = 0x1d;
  m.step(0x0c7c, 7);
  regs.a = 0x10;
  m.step(0x0c7e, 7);
  m.push16(0x0c7f);
  m.step(0x0010, 11); // 0c7e  rst 0x10 -- fill 0x1d bytes; HL+=0x1d, B=0
  m.call(0x0010);
  regs.de = 0x0003;
  m.step(0x0c82, 10);
  regs.addHl(regs.de);
  m.step(0x0c83, 11);
  regs.b = 0x1d;
  m.step(0x0c85, 7);
  m.push16(0x0c86);
  m.step(0x0010, 11); // 0c85  rst 0x10
  m.call(0x0010);
  regs.addHl(regs.de);
  m.step(0x0c87, 11);
  mem.write16(0x880b, regs.hl);
  m.step(0x0c8a, 16); // 0c87  ld (0x880b),hl
  regs.hl = 0x8809;
  m.step(0x0c8d, 10);
  regs.decMem8(mem, regs.hl);
  m.step(0x0c8e, 11); // 0c8d  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 0c8e  ret nz -- countdown not done
  m.step(0x0c8f, 5);

  regs.l = regs.inc8(regs.l);
  m.step(0x0c90, 4); // 0c8f  inc l -- HL = 0x880a
  regs.incMem8(mem, regs.hl);
  m.step(0x0c91, 11); // 0c90  inc (hl) -- (0x880a) state -> 2
  regs.hl = 0x0779;
  m.step(0x0c94, 10);
  regs.bc = 0x0000;
  m.step(0x0c97, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x0c98, 7); // 0c97  ld a,(hl)
  // ROM checksum guard: sum bytes (carry count in C) in 256-byte passes until A==0xc1 && C==0x0c.
  for (;;) {
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0c99, 6); // 0c98  inc hl
    regs.add(mem.read8(regs.hl));
    m.step(0x0c9a, 7); // 0c99  add a,(hl)
    if (regs.fNC) {
      m.step(0x0c9d, 12); // 0c9a  jr nc,0x0c9d (skip inc c)
    } else {
      m.step(0x0c9c, 7);
      regs.c = regs.inc8(regs.c);
      m.step(0x0c9d, 4); // 0c9c  inc c
    }
    if (regs.djnz() !== 0) { m.step(0x0c98, 13); continue; } // 0c9d  djnz 0x0c98
    m.step(0x0c9f, 8);
    regs.cp(0xc1);
    m.step(0x0ca1, 7);
    if (regs.fNZ) { m.step(0x0c98, 12); continue; } // 0ca1  jr nz,0x0c98
    m.step(0x0ca3, 7);
    regs.a = regs.c;
    m.step(0x0ca4, 4);
    regs.cp(0x0c);
    m.step(0x0ca6, 7);
    if (regs.fNZ) { m.step(0x0c98, 12); continue; } // 0ca6  jr nz,0x0c98
    m.step(0x0ca8, 7);
    break;
  }
  regs.bc = 0x0779;
  m.step(0x0cab, 10);
  m.push16(0x0cae);
  m.step(0x075d, 17); // 0cab  call 0x075d
  m.call(0x075d);
  mem.write8(0x880d, regs.a);
  m.step(0x0cb1, 13); // 0cae  ld (0x880d),a
  m.push16(0x0cb4);
  m.step(0x0e54, 17); // 0cb1  call 0x0e54
  m.call(0x0e54);
  m.push16(0x0cb7);
  m.step(0x0cf8, 17); // 0cb4  call 0x0cf8
  m.call(0x0cf8);

  regs.de = 0x0601;
  m.step(0x0cba, 10);
  m.push16(0x0cbb);
  m.step(0x0038, 11); // 0cba  rst 0x38 -- append DE to the display list
  m.call(0x0038);
  regs.e = 0x11;
  m.step(0x0cbd, 7);
  m.push16(0x0cbe);
  m.step(0x0038, 11);
  m.call(0x0038);
  regs.e = 0x16;
  m.step(0x0cc0, 7);
  m.push16(0x0cc1);
  m.step(0x0038, 11);
  m.call(0x0038);
  regs.e = regs.inc8(regs.e);
  m.step(0x0cc2, 4);
  regs.a = mem.read8(0x8800);
  m.step(0x0cc5, 13);
  regs.and(0x01);
  m.step(0x0cc7, 7);
  if (regs.fZ) {
    m.step(0x0ccb, 12); // 0cc7  jr z,0x0ccb
  } else {
    m.step(0x0cc9, 7);
    regs.e = 0x28;
    m.step(0x0ccb, 7); // 0cc9  ld e,0x28
  }
  m.push16(0x0ccc);
  m.step(0x0038, 11);
  m.call(0x0038);
  regs.e = 0x2a;
  m.step(0x0cce, 7);
  regs.a = mem.read8(0x8800);
  m.step(0x0cd1, 13);
  regs.and(0x01);
  m.step(0x0cd3, 7);
  if (regs.fZ) {
    m.step(0x0cd6, 12); // 0cd3  jr z,0x0cd6
  } else {
    m.step(0x0cd5, 7);
    regs.e = regs.dec8(regs.e);
    m.step(0x0cd6, 4); // 0cd5  dec e
  }
  m.push16(0x0cd7);
  m.step(0x0038, 11);
  m.call(0x0038);
  m.push16(0x0cda);
  m.step(0x0f4e, 17); // 0cd7  call 0x0f4e
  m.call(0x0f4e);

  regs.hl = 0x0b26;
  m.step(0x0cdd, 10);
  regs.de = 0x0000;
  m.step(0x0ce0, 10);
  regs.b = 0x20;
  m.step(0x0ce2, 7); // 0ce0  ld b,0x20
  // Second checksum (0x20 bytes at 0x0b26): sum in E, carry count in D. The acting branches were
  // NOP'd out (0cee-0cf0, 0cf4-0cf6) -- a defeated guard; the arithmetic is kept for equivalence.
  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x0ce3, 7); // 0ce2  ld a,(hl)
    regs.add(regs.e);
    m.step(0x0ce4, 4);
    regs.e = regs.a;
    m.step(0x0ce5, 4);
    if (regs.fNC) {
      m.step(0x0ce8, 12); // 0ce5  jr nc,0x0ce8
    } else {
      m.step(0x0ce7, 7);
      regs.d = regs.inc8(regs.d);
      m.step(0x0ce8, 4); // 0ce7  inc d
    }
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0ce9, 6);
    if (regs.djnz() !== 0) { m.step(0x0ce2, 13); continue; } // 0ce9  djnz 0x0ce2
    m.step(0x0ceb, 8);
    break;
  }
  regs.a = regs.e;
  m.step(0x0cec, 4);
  regs.cp(0xd3);
  m.step(0x0cee, 7);
  m.step(0x0cef, 4); // 0cee  nop
  m.step(0x0cf0, 4);
  m.step(0x0cf1, 4);
  regs.a = 0x0b;
  m.step(0x0cf3, 7);
  regs.cp(regs.d);
  m.step(0x0cf4, 4); // 0cf3  cp d
  m.step(0x0cf5, 4); // 0cf4  nop
  m.step(0x0cf6, 4);
  m.step(0x0cf7, 4);
  m.ret(); // 0cf7  ret
}
