// SPDX-License-Identifier: GPL-3.0-only

// loc_5334  (ROM 0x5334-0x5373) -- countdown/expiry handler, gated on the latch (0x8d6e). Reads the
// live script pointer (0x8d71): if its target byte is not 0xff it compares the guard (0x8d6d) against
// (0x8901) and, once reached, clears the guard/latch/(0x8d07) and returns. When the target is 0xff it
// ticks a delay counter (0x8d73); on expiry it advances the pointer, then walks the 6-entry stride-0x18
// table at 0x8ae0 calling 0x5374 per entry (registers banked across the call via exx).
export function loc_5334(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d6e);        m.step(0x5337, 13);
  regs.and(regs.a);                  m.step(0x5338, 4);
  if (regs.fZ) { return m.ret(11); } // 5338  ret z -- not latched
  m.step(0x5339, 5);
  regs.de = mem.read16(0x8d71);      m.step(0x533d, 20); // 5339  ld de,(0x8d71)
  regs.a = mem.read8(regs.de);       m.step(0x533e, 7);
  regs.a = regs.inc8(regs.a);        m.step(0x533f, 4);

  if (regs.fNZ) {
    // 533f  jr nz,0x5355 taken -- target != 0xff: delay-tick / table sweep
    m.step(0x5355, 12);
    regs.hl = 0x8d73;                m.step(0x5358, 10);
    regs.decMem8(mem, regs.hl);      m.step(0x5359, 11);
    if (regs.fNZ) { return m.ret(11); } // 5359  ret nz -- delay still running
    m.step(0x535a, 5);
    regs.a = regs.dec8(regs.a);      m.step(0x535b, 4);
    mem.write8(regs.hl, regs.a);     m.step(0x535c, 7);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x535d, 6);
    mem.write16(0x8d71, regs.de);    m.step(0x5361, 20); // 535d  ld (0x8d71),de
    regs.ix = 0x8ae0;                m.step(0x5365, 14);
    regs.de = 0x0018;                m.step(0x5368, 10);
    regs.b = 0x06;                   m.step(0x536a, 7);
    for (;;) { // 536a: per-entry call, IX advanced by stride 0x18
      regs.exx();                    m.step(0x536b, 4);
      m.push16(0x536e); m.step(0x5374, 17); m.call(0x5374); // 536b  call 0x5374
      regs.exx();                    m.step(0x536f, 4);
      regs.addIx(regs.de);           m.step(0x5371, 15);
      if (regs.djnz()) { m.step(0x536a, 13); continue; }
      m.step(0x5373, 8);
      break;
    }
    return m.ret(10); // 5373  ret
  }

  // 533f  jr nz not taken -- target == 0xff: guard vs (0x8901) threshold
  m.step(0x5341, 7);
  regs.a = mem.read8(0x8d6d);        m.step(0x5344, 13);
  regs.b = regs.a;                   m.step(0x5345, 4);
  regs.a = mem.read8(0x8901);        m.step(0x5348, 13);
  regs.cp(regs.b);                   m.step(0x5349, 4);
  if (regs.fNC) { return m.ret(11); } // 5349  ret nc -- threshold not passed
  m.step(0x534a, 5);
  regs.xor(regs.a);                  m.step(0x534b, 4);
  mem.write8(0x8d6d, regs.a);        m.step(0x534e, 13);
  mem.write8(0x8d6e, regs.a);        m.step(0x5351, 13);
  mem.write8(0x8d07, regs.a);        m.step(0x5354, 13);
  return m.ret(10); // 5354  ret
}
