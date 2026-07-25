// SPDX-License-Identifier: GPL-3.0-only

/**
 * branch_20ec  (ROM 0x20EC–0x2100) — exx; 239c gravity; a proximity gate -> loc_2104.
 *  a 2a2f collision -> entry_2118; else fall into loc_2101.
 */
export function branch_20ec(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.exx();
  m.step(0x20ed, 4); // exx
  m.push16(0x20f0);
  m.step(0x239c, 17); // call 0x239c
  m.call(0x239c);
  regs.a = regs.h; // shadow H (post-exx)
  m.step(0x20f1, 4); // ld a,h
  regs.sub(0x1a);
  m.step(0x20f3, 7); // sub 0x1a
  regs.b = mem.read8(R(0x19));
  m.step(0x20f6, 19); // ld b,(ix+0x19)
  regs.cp(regs.b);
  m.step(0x20f7, 4); // cp b
  if (regs.fC) { m.step(0x2104, 10); return m.call(0x2104); } // jp c -- INTERNAL
  m.step(0x20fa, 10);
  m.push16(0x20fd);
  m.step(0x2a2f, 17); // call 0x2a2f
  m.call(0x2a2f); // returns A
  regs.and(regs.a);
  m.step(0x20fe, 4); // and a
  if (regs.fNZ) { m.step(0x2118, 10); return m.call(0x2118); } // jp nz -- 21xx cluster
  m.step(0x2101, 5); // NOT taken -- falls into loc_2101 (was defb-hidden)
  return m.call(0x2101);
}
