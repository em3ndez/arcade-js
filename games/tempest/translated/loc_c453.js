// SPDX-License-Identifier: GPL-3.0-only
// loc_c453  (ROM 0xc453-0xc471) -- if $5b==0 and $57 is within 0x0c below $5f, bump $57 by 0x0f
// (clamped to 0xf0); several forward branches, all intra-routine, converging on the rts at $c471.
export function loc_c453(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x5b); regs.setNZ(regs.a); m.step(0xc455, 3);
  if (!regs.fZ) { m.step(0xc471, 3); return m.ret(6); }
  m.step(0xc457, 2);
  regs.a = mem.read8(0x57); regs.setNZ(regs.a); m.step(0xc459, 3);
  regs.sec(); m.step(0xc45a, 2);
  regs.sbc(mem.read8(0x5f)); m.step(0xc45c, 3);
  if (regs.fNC) {
    m.step(0xc460, 3);
  } else {
    m.step(0xc45e, 2);
    regs.cmp(0x0c); m.step(0xc460, 2);
  }
  if (regs.fC) { m.step(0xc471, 3); return m.ret(6); }
  m.step(0xc462, 2);
  regs.a = mem.read8(0x5f); regs.setNZ(regs.a); m.step(0xc464, 3);
  regs.clc(); m.step(0xc465, 2);
  regs.adc(0x0f); m.step(0xc467, 2);
  if (regs.fC) {
    m.step(0xc46b, 3);
  } else {
    m.step(0xc469, 2);
    regs.cmp(0xf0); m.step(0xc46b, 2);
  }
  if (regs.fNC) {
    m.step(0xc46f, 3);
  } else {
    m.step(0xc46d, 2);
    regs.a = 0xf0; regs.setNZ(regs.a); m.step(0xc46f, 2);
  }
  mem.write8(0x57, regs.a); m.step(0xc471, 3);
  return m.ret(6);
}
