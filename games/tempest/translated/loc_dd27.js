// SPDX-License-Identifier: GPL-3.0-only
// loc_dd27  (ROM 0xdd27-0xdd28) -- lda #$d0; falls through into loc_dd29.
export function loc_dd27(m) {
  const { regs } = m;
  regs.a = 0xd0; regs.setNZ(regs.a); m.step(0xdd29, 2);
  return m.call(0xdd29);
}
