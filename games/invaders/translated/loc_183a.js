// SPDX-License-Identifier: GPL-3.0-only
// loc_183a  (ROM 0x183a-0x1843) -- called from 0x0bc0 (and fallen into from loc_1837). Walks the
// BC script via 0x1856: each entry is drawn by 0x184c, looping until 0x1856 flags carry (end).
export function loc_183a(m) {
  const { regs } = m;

  for (;;) { // loc_183a
    m.push16(0x183d); m.step(0x1856, 17); m.call(0x1856); // 183a  call 0x1856
    if (regs.fC) { return m.ret(11); } m.step(0x183e, 5); // 183d  rc
    m.push16(0x1841); m.step(0x184c, 17); m.call(0x184c); // 183e  call 0x184c
    m.step(0x183a, 10); // 1841  jmp 0x183a (loop)
  }
}
