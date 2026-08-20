// SPDX-License-Identifier: GPL-3.0-only

// loc_52f6  (ROM 0x52f6-0x5333) -- gated slot sweep + ROM checksum tripwire. Runs only when the
// guard (0x8d6d) is set and the phase latch (0x8d6e) is clear. Counts empty {word==0} slots in the
// 6-entry, stride-0x17 table at 0x8ae0 (loop 0x5309); if fewer than 4 are free it bails (ret c),
// else latches C into 0x8d6e and runs a 23-byte rolling checksum of ROM from 0x0bf3 downward via the
// rst 0x20 helper (HL += byte; loop 0x5321). A mismatch (L != 0x15 or H != 0x09) bumps 0x89e8.
export function loc_52f6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d6d);        m.step(0x52f9, 13);
  regs.and(regs.a);                  m.step(0x52fa, 4);
  if (regs.fZ) { return m.ret(11); } // 52fa  ret z -- guard clear
  m.step(0x52fb, 5);
  regs.a = mem.read8(0x8d6e);        m.step(0x52fe, 13);
  regs.and(regs.a);                  m.step(0x52ff, 4);
  if (regs.fNZ) { return m.ret(11); } // 52ff  ret nz -- already latched
  m.step(0x5300, 5);
  regs.bc = 0x0600;                  m.step(0x5303, 10); // B=6 slots, C=0 free count
  regs.hl = 0x8ae0;                  m.step(0x5306, 10);
  regs.de = 0x0017;                  m.step(0x5309, 10);

  for (;;) { // 5309: count slots whose leading word is zero
    regs.a = mem.read8(regs.hl);       m.step(0x530a, 7);
    regs.l = regs.inc8(regs.l);        m.step(0x530b, 4);
    regs.or(mem.read8(regs.hl));       m.step(0x530c, 7);
    if (regs.fNZ) {
      m.step(0x530f, 12);              // 530c  jr nz,0x530f -- slot in use
    } else {
      m.step(0x530e, 7);
      regs.c = regs.inc8(regs.c);      m.step(0x530f, 4); // free slot
    }
    regs.addHl(regs.de);               m.step(0x5310, 11);
    if (regs.djnz()) { m.step(0x5309, 13); continue; }
    m.step(0x5312, 8);
    break;
  }

  regs.a = regs.c;                   m.step(0x5313, 4);
  regs.cp(0x04);                     m.step(0x5315, 7);
  if (regs.fC) { return m.ret(11); } // 5315  ret c -- fewer than 4 free
  m.step(0x5316, 5);
  mem.write8(0x8d6e, regs.a);        m.step(0x5319, 13); // latch the free count
  regs.de = 0x0bf3;                  m.step(0x531c, 10);
  regs.b = 0x17;                     m.step(0x531e, 7);
  regs.xor(regs.a);                  m.step(0x531f, 4);
  regs.l = regs.a;                   m.step(0x5320, 4);
  regs.h = regs.a;                   m.step(0x5321, 4); // HL = 0 checksum accumulator

  for (;;) { // 5321: HL += ROM[DE] (via rst 0x20 = loc_0020), DE downward
    regs.a = mem.read8(regs.de);       m.step(0x5322, 7);
    m.push16(0x5323); m.step(0x0020, 11); m.call(0x0020); // 5322  rst 0x20 -- HL += A, A = (HL)
    regs.de = (regs.de - 1) & 0xffff;  m.step(0x5324, 6);
    if (regs.djnz()) { m.step(0x5321, 13); continue; }
    m.step(0x5326, 8);
    break;
  }

  regs.a = 0xeb;                     m.step(0x5328, 7);
  regs.add(regs.l);                  m.step(0x5329, 4);
  if (regs.fZ) {                     // 5329  jr nz,0x532f not taken -- L == 0x15
    m.step(0x532b, 7);
    regs.a = regs.h;                 m.step(0x532c, 4);
    regs.add(0xf7);                  m.step(0x532e, 7);
    if (regs.fZ) { return m.ret(11); } // 532e  ret z -- checksum matches (H == 0x09)
    m.step(0x532f, 5);
  } else {
    m.step(0x532f, 12);              // 5329  jr nz,0x532f taken
  }
  regs.hl = 0x89e8;                  m.step(0x5332, 10);
  regs.incMem8(mem, regs.hl);        m.step(0x5333, 11); // tamper tripwire bump
  return m.ret(10); // 5333  ret
}
