// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2243  (ROM 0x2243–0x2258) — hit test: (0x6205)<0x7A && (0x6216)==0 && (0x6203)==(HL) -> ret to caller; else pop-hl/ret caller-skip. HL live-in.
 */
export function loc_2243(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6205);
  m.step(0x2246, 13);
  regs.cp(0x7a);
  m.step(0x2248, 7);
  if (regs.fNC) { return m.call(0x2257); } // jp nc -- no hit
  m.step(0x224b, 10);
  regs.a = mem.read8(0x6216);
  m.step(0x224e, 13);
  regs.and(regs.a);
  m.step(0x224f, 4);
  if (regs.fNZ) { return m.call(0x2257); } // jp nz -- no hit
  m.step(0x2252, 10);
  regs.a = mem.read8(0x6203);
  m.step(0x2255, 13);
  regs.cp(mem.read8(regs.hl));
  m.step(0x2256, 7);
  if (regs.fZ) { m.ret(11); return true; } // ret z -- HIT (caller continues)
  m.step(0x2257, 5);
  return m.call(0x2257);
}
