// SPDX-License-Identifier: GPL-3.0-only

// loc_7fd6  (ROM 0x7fd6-0x7ffe) -- guarded trigger (entry via a 0x7fd6 pointer). Rets unless
// (0x8802) is set. Picks a status byte: (0x880e)==0 keeps HL=0x880e; else the (0x880d) flag chooses
// HL=0x8948 (nz) or HL=0x8988 (z). If A|(HL) is nonzero it rets; otherwise, when (0x8810)&0x18 is
// set, calls 0x0ecf then tail-jps to 0x0d78. The `and a` at 0x7fe4 sets the Z that the later jr nz
// tests -- the two intervening loads leave flags untouched, so that reading must be preserved.
export function loc_7fd6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8802);        m.step(0x7fd9, 13);
  regs.and(regs.a);                  m.step(0x7fda, 4);
  if (regs.fZ) { m.ret(11); return; }               // ret z -- gate clear
  m.step(0x7fdb, 5);                                // ret z not taken

  regs.hl = 0x880e;                  m.step(0x7fde, 10);
  regs.a = mem.read8(regs.hl);       m.step(0x7fdf, 7);
  regs.and(regs.a);                  m.step(0x7fe0, 4);
  if (regs.fZ) {
    m.step(0x7fef, 12);                             // jr z,0x7fef -- HL stays 0x880e
  } else {
    m.step(0x7fe2, 7);
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x7fe3, 6);   // HL=0x880d
    regs.a = mem.read8(regs.hl);      m.step(0x7fe4, 7);
    regs.and(regs.a);                 m.step(0x7fe5, 4);    // Z tested by jr nz below
    regs.a = mem.read8(0x8908);       m.step(0x7fe8, 13);   // no flag effect
    regs.hl = 0x8948;                 m.step(0x7feb, 10);   // no flag effect
    if (regs.fNZ) {
      m.step(0x7fef, 12);                           // jr nz,0x7fef -- HL=0x8948
    } else {
      m.step(0x7fed, 7);
      regs.l = 0x88;                  m.step(0x7fef, 7);    // HL=0x8988
    }
  }

  regs.or(mem.read8(regs.hl));       m.step(0x7ff0, 7);
  regs.and(regs.a);                  m.step(0x7ff1, 4);
  if (regs.fNZ) { m.ret(11); return; }              // ret nz -- already active
  m.step(0x7ff2, 5);                                // ret nz not taken

  regs.a = mem.read8(0x8810);        m.step(0x7ff5, 13);
  regs.and(0x18);                    m.step(0x7ff7, 7);
  regs.and(regs.a);                  m.step(0x7ff8, 4);
  if (regs.fZ) { m.ret(11); return; }               // ret z -- trigger bits clear
  m.step(0x7ff9, 5);                                // ret z not taken

  m.push16(0x7ffc); m.step(0x0ecf, 17); m.call(0x0ecf);   // call 0x0ecf
  m.step(0x0d78, 10); return m.call(0x0d78);              // jp 0x0d78 (tail, BOUNDARY)
}
