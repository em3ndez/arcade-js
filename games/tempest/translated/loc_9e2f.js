// SPDX-License-Identifier: GPL-3.0-only
// loc_9e2f (ROM 0x9e2f-0x9e47) -- per-slot(x) guard: if $0283,x is negative bail; else only when
// $02b9,x == $0200 AND $02cc,x == $0201 (slot's cell coords match the target pair) call $a33a.
// All three guard branches fall through to the shared rts at 0x9e47.
export function loc_9e2f(m) {
  const { regs, mem } = m;

  { const p = 0x0283, e = (p + regs.x) & 0xffff;
    regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e32, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  if (regs.fN) { m.step(0x9e47, 3); return m.ret(6); } // bmi -> rts
  m.step(0x9e34, 2);

  { const p = 0x02b9, e = (p + regs.x) & 0xffff;
    regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e37, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.cmp(mem.read8(0x0200)); m.step(0x9e3a, 4);
  if (regs.fNZ) { m.step(0x9e47, 3); return m.ret(6); } // bne -> rts
  m.step(0x9e3c, 2);

  { const p = 0x02cc, e = (p + regs.x) & 0xffff;
    regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e3f, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.cmp(mem.read8(0x0201)); m.step(0x9e42, 4);
  if (regs.fNZ) { m.step(0x9e47, 3); return m.ret(6); } // bne -> rts
  m.step(0x9e44, 2);

  m.push16(0x9e46); m.step(0x9e47, 6); m.call(0xa33a); // jsr $a33a
  return m.ret(6);
}
