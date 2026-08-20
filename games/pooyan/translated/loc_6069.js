// SPDX-License-Identifier: GPL-3.0-only

// loc_6069  (ROM 0x6069-0x607f) -- entry (also `jp nz` target from 0x60fb). Reads (HL); if 0
// tail-jumps loc_60f2. Else checks (HL+2) == 5, else tail-jumps loc_60f2. If 0x8907 bit0 is
// set tail-jumps loc_61b4, otherwise falls through into loc_6080.
export function loc_6069(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);                     m.step(0x606a, 7);
  regs.and(regs.a);                                m.step(0x606b, 4);
  if (regs.fZ) { m.step(0x60f2, 10); return m.call(0x60f2); } // jp z tail
  m.step(0x606e, 10);                              // jp z not taken
  regs.l = regs.inc8(regs.l);                      m.step(0x606f, 4);
  regs.l = regs.inc8(regs.l);                      m.step(0x6070, 4);
  regs.a = mem.read8(regs.hl);                     m.step(0x6071, 7);
  regs.l = regs.dec8(regs.l);                      m.step(0x6072, 4);
  regs.l = regs.dec8(regs.l);                      m.step(0x6073, 4);
  regs.cp(0x05);                                   m.step(0x6075, 7);
  if (regs.fNZ) { m.step(0x60f2, 10); return m.call(0x60f2); } // jp nz tail
  m.step(0x6078, 10);                              // jp nz not taken
  regs.a = mem.read8(0x8907);                      m.step(0x607b, 13);
  regs.bit(0, regs.a);                             m.step(0x607d, 8);
  if (regs.fNZ) { m.step(0x61b4, 10); return m.call(0x61b4); } // jp nz tail
  m.step(0x6080, 10);                              // jp nz not taken -> fall through
  return m.call(0x6080); // fall through into loc_6080
}
