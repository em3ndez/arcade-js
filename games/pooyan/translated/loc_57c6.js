// SPDX-License-Identifier: GPL-3.0-only

// loc_57c6  (ROM 0x57c6-0x5834) -- eagle sub-state stepper / re-arm. Counter (0x8d46) in 1..6:
// decrements the first non-zero of the 3-byte sub-state block (0x8d47/48/49) and latches the
// eagle's move dir+speed into (ix+0x13)/(ix+0x16), returning each stage. Counter 0 or >=7 falls
// to loc_57fa: resets the counter to 1, and per input flag 0x8907 bit0 picks table 0x5922 (bit
// set) or 0x5985 (clear), indexes it by 3*clamped-position via rst 0x20, copies the 3-byte record
// into (de), then tail-jumps to loc_57c3.
export function loc_57c6(m) {
  const { regs, mem } = m;

  regs.hl = 0x8d46;                 m.step(0x57c9, 10);
  regs.a = mem.read8(regs.hl);      m.step(0x57ca, 7);
  regs.and(regs.a);                 m.step(0x57cb, 4);
  if (regs.fZ) {
    m.step(0x57fa, 12);             // jr z,0x57fa
  } else {
    m.step(0x57cd, 7);
    regs.cp(0x07);                  m.step(0x57cf, 7);
    if (regs.fNC) {
      m.step(0x57fa, 12);           // jr nc,0x57fa
    } else {
      m.step(0x57d1, 7);           // jr nc not taken -> advance the sub-state block
      regs.incMem8(mem, regs.hl);   m.step(0x57d2, 11); // inc (hl)
      regs.l = (regs.l + 1) & 0xff; m.step(0x57d3, 4);
      regs.a = mem.read8(regs.hl);  m.step(0x57d4, 7);
      regs.and(regs.a);             m.step(0x57d5, 4);
      if (regs.fNZ) {
        m.step(0x57d7, 7);          // jr z not taken -- stage 1 active
        regs.decMem8(mem, regs.hl);                    m.step(0x57d8, 11);
        mem.write8((regs.ix + 0x13) & 0xffff, 0x02);   m.step(0x57dc, 19);
        mem.write8((regs.ix + 0x16) & 0xffff, 0x01);   m.step(0x57e0, 19);
        m.ret(); return;
      }
      m.step(0x57e1, 12);           // jr z,0x57e1 -- stage 2
      regs.l = (regs.l + 1) & 0xff; m.step(0x57e2, 4);
      regs.a = mem.read8(regs.hl);  m.step(0x57e3, 7);
      regs.and(regs.a);             m.step(0x57e4, 4);
      if (regs.fNZ) {
        m.step(0x57e6, 7);
        regs.decMem8(mem, regs.hl);                    m.step(0x57e7, 11);
        mem.write8((regs.ix + 0x13) & 0xffff, 0x01);   m.step(0x57eb, 19);
        mem.write8((regs.ix + 0x16) & 0xffff, 0xc1);   m.step(0x57ef, 19);
        m.ret(); return;
      }
      m.step(0x57f0, 12);           // jr z,0x57f0 -- stage 3
      regs.l = (regs.l + 1) & 0xff; m.step(0x57f1, 4);
      regs.a = mem.read8(regs.hl);  m.step(0x57f2, 7);
      regs.and(regs.a);             m.step(0x57f3, 4);
      if (regs.fZ) { m.ret(11); return; } // ret z
      m.step(0x57f4, 5);
      regs.decMem8(mem, regs.hl);                      m.step(0x57f5, 11);
      mem.write8((regs.ix + 0x16) & 0xffff, 0x41);     m.step(0x57f9, 19);
      m.ret(); return;
    }
  }

  // loc_57fa: re-arm -- reset counter, select table + index, copy a 3-byte record, tail to loc_57c3
  mem.write8(regs.hl, 0x01);        m.step(0x57fc, 10);
  regs.a = mem.read8(0x8907);       m.step(0x57ff, 13);
  regs.bit(0, regs.a);              m.step(0x5801, 8);
  if (regs.fZ) {
    m.step(0x5828, 12);             // jr z,0x5828 -- table 0x5985
    regs.cp(0x20);                  m.step(0x582a, 7);
    if (regs.fC) {
      m.step(0x582e, 12);
    } else {
      m.step(0x582c, 7);
      regs.a = 0x1f;                m.step(0x582e, 7); // clamp position to 0x1f
    }
    regs.c = regs.a;                m.step(0x582f, 4);
    regs.exDeHl();                  m.step(0x5830, 4);
    regs.hl = 0x5985;               m.step(0x5833, 10);
    m.step(0x5816, 12);             // jr 0x5816
  } else {
    m.step(0x5803, 7);              // jr z not taken -- table 0x5922
    regs.a = mem.read8(0x8900);     m.step(0x5806, 13);
    regs.c = regs.a;                m.step(0x5807, 4);
    regs.a = mem.read8(0x8d4c);     m.step(0x580a, 13);
    regs.add(regs.c);               m.step(0x580b, 4);
    regs.cp(0x20);                  m.step(0x580d, 7);
    if (regs.fC) {
      m.step(0x5811, 12);
    } else {
      m.step(0x580f, 7);
      regs.a = 0x1f;                m.step(0x5811, 7); // clamp position to 0x1f
    }
    regs.c = regs.a;                m.step(0x5812, 4);
    regs.exDeHl();                  m.step(0x5813, 4);
    regs.hl = 0x5922;               m.step(0x5816, 10);
  }

  // loc_5816: HL = table + 3*position (via rst 0x20), copy the 3 record bytes into (de)
  regs.add(regs.a);                 m.step(0x5817, 4); // add a,a
  regs.add(regs.c);                 m.step(0x5818, 4); // add a,c -> 3*position
  m.push16(0x5819);
  m.step(0x0020, 11);               // 5818  rst 0x20 (loc_0020: HL += A, A = (HL))
  m.call(0x0020);
  regs.de = (regs.de + 1) & 0xffff; m.step(0x581a, 6);
  mem.write8(regs.de, regs.a);      m.step(0x581b, 7);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x581c, 6);
  regs.de = (regs.de + 1) & 0xffff; m.step(0x581d, 6);
  regs.a = mem.read8(regs.hl);      m.step(0x581e, 7);
  mem.write8(regs.de, regs.a);      m.step(0x581f, 7);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x5820, 6);
  regs.de = (regs.de + 1) & 0xffff; m.step(0x5821, 6);
  regs.a = mem.read8(regs.hl);      m.step(0x5822, 7);
  mem.write8(regs.de, regs.a);      m.step(0x5823, 7);
  regs.b = 0xff;                    m.step(0x5825, 7);
  m.step(0x57c3, 10);               // jp 0x57c3 (tail)
  return m.call(0x57c3);
}
