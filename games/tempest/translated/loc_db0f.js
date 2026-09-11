// SPDX-License-Identifier: GPL-3.0-only
// loc_db0f  (ROM 0xdb0f-0xdb21) -- reads index $00, clamps to 2 if >= 0x0e, then pushes the address
// from table $db01,x (lo) / $db02,x (hi) and rts-dispatches to that target (+1).
export function loc_db0f(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x00); regs.setNZ(regs.x); m.step(0xdb11, 3);
  regs.cpx(0x0e); m.step(0xdb13, 2);
  if (regs.fNC) {
    m.step(0xdb19, 3);
  } else {
    m.step(0xdb15, 2);
    regs.x = 0x02; regs.setNZ(regs.x); m.step(0xdb17, 2);
    mem.write8(0x00, regs.x); m.step(0xdb19, 3);
  }
  regs.a = mem.read8((0xdb02 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xdb1c, 4);
  m.push8(regs.a); m.step(0xdb1d, 3);
  regs.a = mem.read8((0xdb01 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xdb20, 4);
  m.push8(regs.a); m.step(0xdb21, 3);
  const t = (m.pull16() + 1) & 0xffff; m.step(t, 6); return m.call(t);
}
