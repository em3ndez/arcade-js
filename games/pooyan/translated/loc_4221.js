// SPDX-License-Identifier: GPL-3.0-only

// loc_4221  (ROM 0x4221-0x42d9) -- object state handler (an m.call dispatch target). Ticks loc_4006,
// then branches on (ix+0x08) bit0. Each branch reads (ix+0x06)&0x1f as a phase timer and, past its
// threshold, either arms an animation script -- ld de,<ptr>; ld (0x8d4b),a; jp 0x381e (loc_381e) --
// or drops into the shared tail at 0x4290, which scans/clears the object tables at 0x8ae0 & 0x8c48
// (loc_42da per slot). 0x423a (script 0x4212) and 0x425c (script 0x4203) are also external entry
// points reached by loc_4350's jp -- flagged as boundaries so the merge can register them.
// Data islands 0x4283-0x428f (loc_4266's ROM string) and 0x4212/0x4203 (script tables) are not code.
export function loc_4221(m) {
  const { regs, mem } = m;

  const dispatch381e = () => {           // 0x4241: jp 0x381e (tail, reused by 0x423a and 0x425c)
    m.step(0x381e, 10);
    return m.call(0x381e);
  };

  const blockC9 = () => {                // 0x42c9: clear 3 slots of the 0x8c48 table (stride 0x18)
    regs.iy = 0x8c48;                    m.step(0x42cd, 14);
    regs.b = 0x03;                       m.step(0x42cf, 7);
    for (;;) {
      m.push16(0x42d2);
      m.step(0x42da, 17);                // 42cf  call 0x42da (BOUNDARY)
      m.call(0x42da);
      if (m.pc !== 0x42d2) return;       // loc_42da skip-returned past this loop; propagate
      regs.de = 0x0018;                  m.step(0x42d5, 10);
      regs.addIy(regs.de);              m.step(0x42d7, 15);
      if (regs.djnz()) { m.step(0x42cf, 13); } else { m.step(0x42d9, 8); return m.ret(10); }
    }
  };

  const blockP = () => {                 // 0x4290: shared bookkeeping tail (A = (ix+0x06)&0x1f)
    regs.cp(0x05);                       m.step(0x4292, 7);
    if (regs.fC) { return m.ret(11); }   // 4292  ret c
    m.step(0x4293, 5);
    regs.hl = 0x8d5b;                    m.step(0x4296, 10);
    regs.a = mem.read8(regs.hl);         m.step(0x4297, 7);
    regs.and(regs.a);                    m.step(0x4298, 4);
    if (regs.fNZ) { m.step(0x42c9, 12); return blockC9(); } // 4298  jr nz,0x42c9
    m.step(0x429a, 7);
    regs.hl = (regs.hl - 1) & 0xffff;    m.step(0x429b, 6);
    regs.a = mem.read8(regs.hl);         m.step(0x429c, 7);
    regs.and(regs.a);                    m.step(0x429d, 4);
    if (regs.fNZ) {                      // 429d  jr z,0x42a1 not taken -> dec (hl); ret
      m.step(0x429f, 7);
      regs.decMem8(mem, regs.hl);        m.step(0x42a0, 11); // 429f  dec (hl)
      return m.ret(10);                  // 42a0  ret
    }
    m.step(0x42a1, 12);                  // 429d  jr z,0x42a1 taken
    regs.a = mem.read8(0x8901);          m.step(0x42a4, 13); // 0x42a1
    regs.cp(0x08);                       m.step(0x42a6, 7);
    regs.de = 0x0018;                    m.step(0x42a9, 10);
    if (regs.fC) {
      m.step(0x42c0, 12);               // 42a9  jr c,0x42c0 taken
    } else {
      m.step(0x42ab, 7);
      regs.iy = 0x8ae0;                  m.step(0x42af, 14);
      regs.a = mem.read8(0x8d5c);        m.step(0x42b2, 13);
      regs.b = regs.a;                   m.step(0x42b3, 4);
      regs.c = regs.a;                   m.step(0x42b4, 4);
      for (;;) {                         // 0x42b4: scan for a slot whose (iy+0x04)==7
        regs.a = mem.read8((regs.iy + 0x04) & 0xffff); m.step(0x42b7, 19);
        regs.cp(0x07);                   m.step(0x42b9, 7);
        if (regs.fZ) { m.step(0x42c0, 12); break; } // jr z,0x42c0
        m.step(0x42bb, 7);
        regs.addIy(regs.de);            m.step(0x42bd, 15);
        if (regs.djnz()) { m.step(0x42b4, 13); } else { m.step(0x42bf, 8); return m.ret(10); }
      }
    }
    regs.a = mem.read8(0x8d5d);          m.step(0x42c3, 13); // 0x42c0
    mem.write8(0x8d5a, regs.a);          m.step(0x42c6, 13);
    mem.write8(0x8d5b, regs.a);          m.step(0x42c9, 13);
    return blockC9();
  };

  m.push16(0x4224);
  m.step(0x4006, 17);                    // 4221  call 0x4006
  m.call(0x4006);
  regs.bit(0, mem.read8((regs.ix + 0x08) & 0xffff), ((regs.ix + 0x08) >> 8) & 0xff);
  m.step(0x4228, 20);                    // 4224  bit 0,(ix+0x08)
  if (regs.fNZ) {                        // 4228  jr nz,0x4244
    m.step(0x4244, 12);
    m.push16(0x4247);
    m.step(0x34f2, 17);                  // 4244  call 0x34f2 (BOUNDARY)
    m.call(0x34f2);
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x424a, 19);
    regs.and(0x1f);                      m.step(0x424c, 7);
    regs.cp(0x0a);                       m.step(0x424e, 7);
    if (regs.fNC) { m.step(0x4290, 12); return blockP(); } // 424e  jr nc,0x4290
    m.step(0x4250, 7);
    regs.b = regs.a;                     m.step(0x4251, 4);
    regs.a = mem.read8(0x8901);          m.step(0x4254, 13);
    regs.cp(0x02);                       m.step(0x4256, 7);
    if (regs.fC) {                       // 4256  jr c,0x4266
      m.step(0x4266, 12);
      regs.a = regs.b;                   m.step(0x4267, 4);
      regs.cp(0x02);                     m.step(0x4269, 7);
      if (regs.fNC) { return m.ret(11); } // 4269  ret nc
      m.step(0x426a, 5);
      m.push16(0x426d);
      m.step(0x3553, 17);               // 426a  call 0x3553
      m.call(0x3553);
      regs.de = 0x0bb9;                  m.step(0x4270, 10);
      regs.hl = 0x4283;                  m.step(0x4273, 10);
      for (;;) {                         // 0x4273: match (de) against the 0x4283 string
        regs.a = mem.read8(regs.de);     m.step(0x4274, 7);
        regs.add(mem.read8(regs.hl));    m.step(0x4275, 7);
        if (regs.fNZ) {                  // 4275  jr nz,0x427e
          m.step(0x427e, 12);
          regs.hl = 0x8a3a;              m.step(0x4281, 10);
          regs.incMem8(mem, regs.hl);    m.step(0x4282, 11); // inc (hl)
          return m.ret(10);
        }
        m.step(0x4277, 7);
        regs.de = (regs.de - 1) & 0xffff; m.step(0x4278, 6);
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x4279, 6);
        regs.a = mem.read8(regs.hl);     m.step(0x427a, 7);
        regs.a = regs.inc8(regs.a);      m.step(0x427b, 4); // inc a (0xff terminator -> Z)
        if (regs.fZ) { return m.ret(11); } // 427b  ret z
        m.step(0x427c, 5);
        m.step(0x4273, 12);             // 427c  jr 0x4273
      }
    }
    m.step(0x4258, 7);                   // 4256  jr c not taken
    mem.write8((regs.ix + 0x08) & 0xffff, 0x00); m.step(0x425c, 19); // 0x425c: ld (ix+0x08),0
    regs.de = 0x4203;                    m.step(0x425f, 10);
    regs.a = 0xff;                       m.step(0x4261, 7);
    mem.write8(0x8d4b, regs.a);          m.step(0x4264, 13);
    m.step(0x4241, 12);                 // 4264  jr 0x4241
    return dispatch381e();
  }
  m.step(0x422a, 7);                     // 4228  jr nz not taken
  m.push16(0x422d);
  m.step(0x343e, 17);                    // 422a  call 0x343e (BOUNDARY)
  m.call(0x343e);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x4230, 19);
  regs.and(0x1f);                        m.step(0x4232, 7);
  regs.cp(0x14);                         m.step(0x4234, 7);
  if (regs.fC) { m.step(0x4290, 12); return blockP(); } // 4234  jr c,0x4290
  m.step(0x4236, 7);
  mem.write8((regs.ix + 0x08) & 0xffff, 0x01); m.step(0x423a, 19); // 0x423a: ld (ix+0x08),1
  regs.de = 0x4212;                      m.step(0x423d, 10);
  regs.xor(regs.a);                      m.step(0x423e, 4);  // xor a
  mem.write8(0x8d4b, regs.a);            m.step(0x4241, 13);
  return dispatch381e();
}
