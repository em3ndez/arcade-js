// SPDX-License-Identifier: GPL-3.0-only
// loc_08ff  (ROM 0x08ff-0x0912) -- widely-called sprite-index -> source-pointer helper. Computes
// DE = 0x1e00 + 8*A (HL preserved across the body via push/pop), latches A to the shift-count
// port 6 with B=8, and tail-jumps to the blitter loc_1439.
export function loc_08ff(m) {
  const { regs } = m;

  regs.de = 0x1e00; m.step(0x0902, 10); // 08ff  lxi d,0x1e00
  m.push16(regs.hl); m.step(0x0903, 11); // 0902  push h
  regs.h = 0x00; m.step(0x0905, 7); // 0903  mvi h,0x00
  regs.l = regs.a; m.step(0x0906, 5); // 0905  mov l,a
  regs.addHl(regs.hl); m.step(0x0907, 10); // 0906  dad h
  regs.addHl(regs.hl); m.step(0x0908, 10); // 0907  dad h
  regs.addHl(regs.hl); m.step(0x0909, 10); // 0908  dad h
  regs.addHl(regs.de); m.step(0x090a, 10); // 0909  dad d
  regs.exDeHl(); m.step(0x090b, 4); // 090a  xchg
  regs.hl = m.pop16(); m.step(0x090c, 10); // 090b  pop h
  regs.b = 0x08; m.step(0x090e, 7); // 090c  mvi b,0x08
  m.io.portOut(0x06, regs.a); m.step(0x0910, 10); // 090e  out 0x06
  m.step(0x1439, 10); return m.call(0x1439); // 0910  jmp 0x1439
}
