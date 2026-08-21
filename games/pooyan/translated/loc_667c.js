// SPDX-License-Identifier: GPL-3.0-only

// loc_667c  (ROM 0x667c-0x66a0) -- advances one actor while its (ix+0x01) state is 0. Adds the per-frame
// step (ix+0x09) into the position (ix+0x05), carrying into (ix+0x06); once the carried high byte reaches
// 0x1d the record is retired: state (ix+0x01)=0x02 and (ix+0x04)/(ix+0x06) cleared. Below 0x1d it rets.
export function loc_667c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x01) & 0xffff); m.step(0x667f, 19);
  regs.and(regs.a);            m.step(0x6680, 4);
  if (regs.fNZ) { return m.ret(11); } // 6680  ret nz -- state not 0
  m.step(0x6681, 5);

  regs.a = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x6684, 19);
  regs.add(mem.read8((regs.ix + 0x09) & 0xffff)); m.step(0x6687, 19);
  if (regs.fNC) {
    m.step(0x668c, 12); // 6687  jr nc,0x668c
  } else {
    m.step(0x6689, 7);
    regs.incMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x668c, 23);
  }
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x668f, 19);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x6692, 19);
  regs.cp(0x1d);               m.step(0x6694, 7);
  if (regs.fC) { return m.ret(11); } // 6694  ret c -- still below 0x1d
  m.step(0x6695, 5);

  mem.write8((regs.ix + 0x01) & 0xffff, 0x02); m.step(0x6699, 19);
  regs.xor(regs.a);            m.step(0x669a, 4);
  mem.write8((regs.ix + 0x04) & 0xffff, regs.a); m.step(0x669d, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a); m.step(0x66a0, 19);
  return m.ret(10); // 66a0  ret
}
