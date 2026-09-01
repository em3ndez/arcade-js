// SPDX-License-Identifier: GPL-3.0-only
// loc_0332 (ROM 0x0332-0x0337) -- jc target at 0x02f2 (the carry-set arm of loc_02ed). Calls the
// 0x0209 flavour of the setup helper, then tail-jumps into loc_02f8 (a routine head), delegating.
export function loc_0332(m) {
  m.push16(0x0335); m.step(0x0209, 17); m.call(0x0209); // 0332  call 0x0209
  m.step(0x02f8, 10);                                   // 0335  jmp 0x02f8
  return m.call(0x02f8);
}
