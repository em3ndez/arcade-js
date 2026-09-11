// SPDX-License-Identifier: GPL-3.0-only
// loc_b622 (ROM 0xb622-0xb62d) -- small handler: loads slot x's index into Y from $02b9,x, then builds A
// from a 4-frame animation phase -- ($03 & 3) doubled plus $12 -- and tail-jmps into $bcfd with it.
export function loc_b622(m) {
  const { regs, mem } = m;
  { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0xb625, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xb627, 3);
  regs.and(0x03); m.step(0xb629, 2);
  regs.a = regs.asl(regs.a); m.step(0xb62a, 2);
  regs.clc(); m.step(0xb62b, 2);
  regs.adc(0x12); m.step(0xb62d, 2);
  m.step(0xbcfd, 3); return m.call(0xbcfd); // jmp $bcfd tail (no push16)
}
