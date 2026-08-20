// SPDX-License-Identifier: GPL-3.0-only

// loc_5374  (ROM 0x5374-0x539f) -- one-shot activator for the table entry pointed at by IX.
// If the 16-bit word (ix+0,ix+1) is non-zero the entry is already live -> ret. Otherwise it bumps
// counter 0x8d79, marks the entry active ((ix+0)=1), picks E (0x1d or 0x04 per 0x8907 bit0), inits
// via 0x53a0, then OR's the rst-0x20 lookup of table 0x53a6 (index (0x8d74)) into (ix+7). The trailing
// `pop af` DISCARDS the caller's return address, so the closing `ret` returns one level ABOVE the
// caller (skip-return); the early `ret nz` path returns normally.
export function loc_5374(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);   m.step(0x5377, 19);
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff));    m.step(0x537a, 19);
  if (regs.fNZ) { return m.ret(11); } // 537a  ret nz -- entry already active
  m.step(0x537b, 5);
  regs.hl = 0x8d79;                                 m.step(0x537e, 10);
  regs.incMem8(mem, regs.hl);                        m.step(0x537f, 11);
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);      m.step(0x5383, 19);
  regs.a = mem.read8(0x8907);                        m.step(0x5386, 13);
  regs.e = 0x1d;                                     m.step(0x5388, 7);
  regs.bit(0, regs.a);                               m.step(0x538a, 8);
  if (regs.fNZ) {
    m.step(0x538e, 12);        // 538a  jr nz -- keep E=0x1d
  } else {
    m.step(0x538c, 7);
    regs.e = 0x04;             m.step(0x538e, 7);
  }
  m.push16(0x5391);
  m.step(0x53a0, 17);          // 538e  call 0x53a0
  m.call(0x53a0);
  regs.hl = 0x53a6;                                  m.step(0x5394, 10);
  regs.a = mem.read8(0x8d74);                         m.step(0x5397, 13);
  m.push16(0x5398);
  m.step(0x0020, 11);          // 5397  rst 0x20 -- A = table[0x53a6 + A]
  m.call(0x0020);
  regs.or(mem.read8((regs.ix + 0x07) & 0xffff));     m.step(0x539b, 19);
  mem.write8((regs.ix + 0x07) & 0xffff, regs.a);     m.step(0x539e, 19);
  regs.af = m.pop16();                               m.step(0x539f, 10); // 539e  pop af -- drop caller ret
  return m.ret(10);            // 539f  ret -- returns one level above the caller
}
