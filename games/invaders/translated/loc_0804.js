// SPDX-License-Identifier: GPL-3.0-only
// loc_0804  (ROM 0x0804-0x0813) -- `jmp 0x0804` entry. Reads flag 0x2067; bit0 set -> delegate
// to loc_0872, else two calls and fall through into loc_0814.
export function loc_0804(m) {
  const { regs, mem } = m;

  m.push16(0x0807); m.step(0x01cf, 17); m.call(0x01cf); // 0804  call 0x01cf
  regs.a = mem.read8(0x2067); m.step(0x080a, 13); // 0807  lda 0x2067
  regs.rrca(); m.step(0x080b, 4); // 080a  rrc
  if (regs.fC) { m.step(0x0872, 10); return m.call(0x0872); } // 080b  jc 0x0872
  m.step(0x080e, 10);
  m.push16(0x0811); m.step(0x0213, 17); m.call(0x0213); // 080e  call 0x0213
  m.push16(0x0814); m.step(0x01cf, 17); m.call(0x01cf); // 0811  call 0x01cf
  return m.call(0x0814); // fall through into loc_0814
}
