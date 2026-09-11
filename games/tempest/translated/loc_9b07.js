// SPDX-License-Identifier: GPL-3.0-only
// loc_9b07  (ROM 0x9b07-0x9b1d) -- saves Y in $36; if $29 >= 0x20 dispatches via loc_9a88, else Y=$2b and
// calls loc_9aee; restores Y from $36 and returns. (clv/bvc is an unconditional skip.)
export function loc_9b07(m) {
  const { regs, mem } = m;
  mem.write8(0x36, regs.y); m.step(0x9b09, 3);
  regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0x9b0b, 3);
  regs.cmp(0x20); m.step(0x9b0d, 2);
  regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0x9b0f, 3);
  if (regs.fC) {
    m.step(0x9b18, 3);
    m.push16(0x9b1a); m.step(0x9b1b, 6); m.call(0x9a88);
  } else {
    m.step(0x9b11, 2);
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9b12, 2);
    m.push16(0x9b14); m.step(0x9b15, 6); m.call(0x9aee);
    regs.clv(); m.step(0x9b16, 2);
    m.step(0x9b1b, 3);
  }
  regs.y = mem.read8(0x36); regs.setNZ(regs.y); m.step(0x9b1d, 3);
  return m.ret(6);
}
