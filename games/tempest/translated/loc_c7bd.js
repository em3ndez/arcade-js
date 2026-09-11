// SPDX-License-Identifier: GPL-3.0-only
// loc_c7bd  (ROM 0xc7bd-0xc7d9) -- if ($0d00 & $83)==$82 just rts; else jsr a7d2, set bit7 of $4e, and push
// a computed return (table $c7da/$c7db[$00]) so the rts trampolines to that dispatch target (table16+1).
export function loc_c7bd(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0d00); regs.setNZ(regs.a); m.step(0xc7c0, 4);
  regs.and(0x83); m.step(0xc7c2, 2);
  regs.cmp(0x82); m.step(0xc7c4, 2);
  if (regs.fZ) { m.step(0xc7d9, 3); return m.ret(6); }
  m.step(0xc7c6, 2);
  m.push16(0xc7c8); m.step(0xc7c9, 6); m.call(0xa7d2);
  regs.x = mem.read8(0x00); regs.setNZ(regs.x); m.step(0xc7cb, 3);
  regs.a = mem.read8(0x4e); regs.setNZ(regs.a); m.step(0xc7cd, 3);
  regs.ora(0x80); m.step(0xc7cf, 2);
  mem.write8(0x4e, regs.a); m.step(0xc7d1, 3);
  { const ea = (0xc7db + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc7d4, (0xc7db & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  m.push8(regs.a); m.step(0xc7d5, 3);
  { const ea = (0xc7da + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xc7d8, (0xc7da & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  m.push8(regs.a); m.step(0xc7d9, 3);
  const t = (m.pull16() + 1) & 0xffff; m.step(t, 6); return m.call(t);
}
