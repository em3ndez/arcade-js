// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e7a  (ROM 0x1E7A–0x1E7D) — 1E57 interior: cp 0x31 -> normal ret, or into loc_1e6d.
 */
export function loc_1e7a(m) {
  const { regs } = m;
  regs.cp(0x31);
  m.step(0x1e7c, 7); // cp 0x31
  if (!regs.fC) {
    m.ret(11); // ret nc -- NORMAL
    return true;
  }
  m.step(0x1e7d, 5); // ret nc not taken
  m.step(0x1e6d, 10); // jp 0x1e6d
  return m.call(0x1e6d);
}
