// SPDX-License-Identifier: GPL-3.0-only
// loc_09ad  (ROM 0x09ad-0x09b1) -- `jmp 0x09ad` entry (from loc_0988 and 0x1939). Emits D then E
// as hex: call loc_09b2 for D, set A=E, then fall through into loc_09b2 for E.
export function loc_09ad(m) {
  const { regs } = m;

  regs.a = regs.d; m.step(0x09ae, 5); // 09ad  mov a,d
  m.push16(0x09b1); m.step(0x09b2, 17); m.call(0x09b2); // 09ae  call 0x09b2
  regs.a = regs.e; m.step(0x09b2, 5); // 09b1  mov a,e
  return m.call(0x09b2); // fall through into loc_09b2 (next band)
}
