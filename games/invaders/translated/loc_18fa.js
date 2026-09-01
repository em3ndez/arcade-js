// SPDX-License-Identifier: GPL-3.0-only
// loc_18fa  (ROM 0x18fa-0x1903) -- OR B into the sound-latch shadow 0x2094, store it back,
// and mirror it to output port 3 (sound bits). B carries the bits to set.
export function loc_18fa(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2094); m.step(0x18fd, 13); // 18fa  lda 0x2094
  regs.or(regs.b); m.step(0x18fe, 4); // 18fd  ora b
  mem.write8(0x2094, regs.a); m.step(0x1901, 13); // 18fe  sta 0x2094
  m.io.portOut(0x03, regs.a); m.step(0x1903, 10); // 1901  out 0x03
  return m.ret(10); // 1903  ret
}
