// SPDX-License-Identifier: GPL-3.0-only
// loc_1837  (ROM 0x1837-0x1839) -- reached by `jc 0x1837` from loc_1815. Points BC at the
// 0x1dcf script, then falls through into loc_183a to walk it.
export function loc_1837(m) {
  const { regs } = m;

  regs.bc = 0x1dcf; m.step(0x183a, 10); // 1837  lxi b,0x1dcf
  return m.call(0x183a); // 183a  fall through into loc_183a
}
