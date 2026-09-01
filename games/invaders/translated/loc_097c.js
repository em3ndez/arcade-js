// SPDX-License-Identifier: GPL-3.0-only
// loc_097c  (ROM 0x097c-0x0987) -- `call 0x097c` from loc_0a6e. Small clamp/index: returns
// HL = 0x1da0 + (A>=2 ? 1 : 0) + (A>=4 ? 1 : 0), i.e. maps A into the 3-entry table at 0x1da0.
export function loc_097c(m) {
  const { regs } = m;

  regs.hl = 0x1da0; m.step(0x097f, 10); // 097c  lxi h,0x1da0
  regs.cp(0x02); m.step(0x0981, 7); // 097f  cpi 0x02
  if (regs.fC) { return m.ret(11); } m.step(0x0982, 5); // 0981  rc
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0983, 5); // 0982  inx h
  regs.cp(0x04); m.step(0x0985, 7); // 0983  cpi 0x04
  if (regs.fC) { return m.ret(11); } m.step(0x0986, 5); // 0985  rc
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0987, 5); // 0986  inx h
  return m.ret(10); // 0987  ret
}
