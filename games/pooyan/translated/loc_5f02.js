// SPDX-License-Identifier: GPL-3.0-only

// loc_5f02  (ROM 0x5f02-0x5f05) -- call-and-return trampoline into loc_0ef1.
// Reached both as its own entry and as the tail target of loc_5f11's `jr 0x5f02`.
export function loc_5f02(m) {
  m.push16(0x5f05);
  m.step(0x0ef1, 17);   // 5f02  call 0x0ef1
  m.call(0x0ef1);

  return m.ret(10);     // 5f05  ret
}
