// SPDX-License-Identifier: GPL-3.0-only
// loc_ddf7  (ROM 0xddf7-0xddfa) -- lda #$03; bne $ddfd (always taken, A!=0) into the loc_ddfb tail entry
// at $ddfd (Y=$00 path). Not-taken falls into loc_ddfb.
export function loc_ddf7(m) {
  const { regs } = m;
  regs.a = 0x03; regs.setNZ(regs.a); m.step(0xddf9, 2);
  if (regs.fNZ) { m.step(0xddfd, 3); return m.call(0xddfd); }
  m.step(0xddfb, 2); return m.call(0xddfb);
}
