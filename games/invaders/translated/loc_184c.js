// SPDX-License-Identifier: GPL-3.0-only
// loc_184c  (ROM 0x184c-0x1855) -- load C from the byte at 0x206c, call loc_0a93 with it,
// then restore BC (push b/pop b bracket the call) and return.
export function loc_184c(m) {
  const { regs, mem } = m;

  m.push16(regs.bc); m.step(0x184d, 11); // 184c  push b
  regs.a = mem.read8(0x206c); m.step(0x1850, 13); // 184d  lda 0x206c
  regs.c = regs.a; m.step(0x1851, 5); // 1850  mov c,a
  m.push16(0x1854); m.step(0x0a93, 17); m.call(0x0a93); // 1851  call 0x0a93
  regs.bc = m.pop16(); m.step(0x1855, 10); // 1854  pop b
  return m.ret(10); // 1855  ret
}
