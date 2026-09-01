// SPDX-License-Identifier: GPL-3.0-only
// loc_0a59  (ROM 0x0a59-0x0a5e) -- read [0x2015] and compare to 0xff (flags only), then ret.
// The Z flag it leaves is the poll answer read by loc_0a3c's jnz/jz/rz.
export function loc_0a59(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2015); m.step(0x0a5c, 13); // 0a59 lda 0x2015
  regs.cp(0xff); m.step(0x0a5e, 7);               // 0a5c cpi 0xff
  return m.ret(10);                               // 0a5e ret
}
