// SPDX-License-Identifier: GPL-3.0-only
// loc_166b  (ROM 0x166b-0x166c) -- tail entry `jnz 0x166b` from 0x15c9: sets carry, returns.
export function loc_166b(m) {
  const { regs } = m;

  regs.scf(); m.step(0x166c, 4); // 166b  stc
  return m.ret(10); // 166c  ret
}
