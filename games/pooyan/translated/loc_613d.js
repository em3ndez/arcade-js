// SPDX-License-Identifier: GPL-3.0-only

// loc_613d  (ROM 0x613d-0x615c) -- matched-record handler. If (iy+0)bit0 clear tail-jump loc_618a.
// Bail to boundary 0x6166 when 0x8907 bit0 is set, or when 0x8d44 != 3. Otherwise load A=(iy+0x14),
// point IX at 0x8b70, DE=0x18, B=6 and fall through into the loc_615d scan.
export function loc_613d(m) {
  const { regs, mem } = m;

  regs.bit(0, mem.read8((regs.iy + 0x00) & 0xffff), ((regs.iy + 0x00) >> 8) & 0xff); m.step(0x6141, 20);
  if (regs.fZ) { m.step(0x618a, 12); return m.call(0x618a); } // jr z tail
  m.step(0x6143, 7);                          // jr z not taken
  regs.a = mem.read8(0x8907);                m.step(0x6146, 13);
  regs.and(0x01);                            m.step(0x6148, 7);
  if (regs.fNZ) { m.step(0x6166, 12); return m.call(0x6166); } // jr nz tail -> boundary
  m.step(0x614a, 7);                          // jr nz not taken
  regs.a = mem.read8(0x8d44);                m.step(0x614d, 13);
  regs.cp(0x03);                             m.step(0x614f, 7);
  if (regs.fNZ) { m.step(0x6166, 12); return m.call(0x6166); } // jr nz tail -> boundary
  m.step(0x6151, 7);                          // jr nz not taken
  regs.a = mem.read8((regs.iy + 0x14) & 0xffff); m.step(0x6154, 19);
  regs.ix = 0x8b70;                          m.step(0x6158, 14);
  regs.de = 0x0018;                          m.step(0x615b, 10);
  regs.b = 0x06;                             m.step(0x615d, 7);
  return m.call(0x615d); // fall through into loc_615d
}
