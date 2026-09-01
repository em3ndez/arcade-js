// SPDX-License-Identifier: GPL-3.0-only
// loc_0abb  (ROM 0x0abb-0x0abe) -- discard the caller's return address into HL (`pop h`) and
// tail-jump into 0x0072. Reached from loc_0abf's `jc 0x0abb` (bit-0 dispatch). Delegate.
export function loc_0abb(m) {
  const { regs } = m;

  regs.hl = m.pop16(); m.step(0x0abc, 10); // 0abb pop h
  m.step(0x0072, 10); return m.call(0x0072); // 0abc jmp 0x0072
}
