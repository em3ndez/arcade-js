// SPDX-License-Identifier: GPL-3.0-only

// loc_338a  (ROM 0x338a-0x339a) -- state dispatcher. Runs only when (ix+0)|(ix+1) has bit0 set
// and (ix+2)&0x1f < 0x11; then rst 0x28 tail-dispatches through the inline word table at 0x339b
// (17 handlers, index (ix+2)&0x1f). The selected handler ret's to loc_338a's caller.
export function loc_338a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x338d, 19);
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x3390, 19);
  regs.rrca();                                   m.step(0x3391, 4);
  if (regs.fNC) { return m.ret(11); }            // 3391 ret nc -- bit0 of OR clear
  m.step(0x3392, 5);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x3395, 19);
  regs.and(0x1f);                                m.step(0x3397, 7);
  regs.cp(0x11);                                 m.step(0x3399, 7);
  if (regs.fNC) { return m.ret(11); }            // 3399 ret nc -- index out of range
  m.step(0x339a, 5);
  m.push16(0x339b);                              // 339a rst 0x28 pushes return = inline table base
  m.step(0x0028, 11);
  return m.call(0x0028);                         // tail dispatch: loc_0028 -> handler -> caller
}
