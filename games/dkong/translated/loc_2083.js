// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2083  (ROM 0x2083–0x20E9) — the 2a2f-nonzero sub-state machine on (ix+0e).
 */
export function loc_2083(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  mem.write8(R(0x0e), regs.inc8(mem.read8(R(0x0e))));
  m.step(0x2086, 23); // inc (ix+0x0e)
  regs.a = mem.read8(R(0x0e));
  m.step(0x2089, 19); // ld a,(ix+0x0e)
  regs.a = regs.dec8(regs.a);
  m.step(0x208a, 4); // dec a
  if (regs.fZ) { m.step(0x20a2, 10); return m.call(0x20a2); } // jp z -- state 1
  m.step(0x208d, 10);
  regs.a = regs.dec8(regs.a);
  m.step(0x208e, 4); // dec a
  if (regs.fZ) { m.step(0x20c3, 10); return m.call(0x20c3); } // jp z -- state 2
  m.step(0x2091, 10);
  regs.a = mem.read8(R(0x10));
  m.step(0x2094, 19); // ld a,(ix+0x10)
  regs.a = regs.dec8(regs.a);
  m.step(0x2095, 4); // dec a
  regs.a = 0x04;
  m.step(0x2097, 7); // ld a,0x04
  if (regs.fNZ) {
    m.step(0x209c, 10); // jp nz -- keep A=0x04
  } else {
    m.step(0x209a, 10);
    regs.a = 0x02;
    m.step(0x209c, 7); // ld a,0x02
  }
  mem.write8(R(0x02), regs.a);
  m.step(0x209f, 19); // ld (ix+0x02),a
  m.step(0x21ba, 10); // jp 0x21ba
  return m.call(0x21ba);
}
