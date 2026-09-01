// SPDX-License-Identifier: GPL-3.0-only
// loc_0abf  (ROM 0x0abf-0x0ace) -- dispatch on the low bits of [0x20c1] via successive RRC:
// bit0 -> 0x0abb, bit1 -> 0x1868, bit2 -> 0x0aab (each a conditional tail-jump); else ret.
export function loc_0abf(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x20c1); m.step(0x0ac2, 13); // 0abf lda 0x20c1
  regs.rrca(); m.step(0x0ac3, 4);                 // 0ac2 rrc
  if (regs.fC) { m.step(0x0abb, 10); return m.call(0x0abb); } // 0ac3 jc 0x0abb
  m.step(0x0ac6, 10);
  regs.rrca(); m.step(0x0ac7, 4);                 // 0ac6 rrc
  if (regs.fC) { m.step(0x1868, 10); return m.call(0x1868); } // 0ac7 jc 0x1868
  m.step(0x0aca, 10);
  regs.rrca(); m.step(0x0acb, 4);                 // 0aca rrc
  if (regs.fC) { m.step(0x0aab, 10); return m.call(0x0aab); } // 0acb jc 0x0aab
  m.step(0x0ace, 10);
  return m.ret(10);                               // 0ace ret
}
