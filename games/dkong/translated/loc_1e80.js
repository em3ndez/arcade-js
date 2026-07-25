// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e80  (ROM 0x1E80–0x1E84) — 1E57 interior: 0x6290 test -> normal ret, or unwind.
 */
export function loc_1e80(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6290);
  m.step(0x1e83, 13); // ld a,(0x6290)
  regs.and(regs.a);
  m.step(0x1e84, 4); // and a
  if (regs.fNZ) {
    m.ret(11); // ret nz -- NORMAL
    return true;
  }
  m.step(0x1e85, 5); // ret nz not taken
  return m.call(0x1e85);
}
